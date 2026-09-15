import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { toPng } from 'html-to-image';
import { ensureStoragePermission } from './storagePermission';

/**
 * Captures a given DOM element (e.g. modal container) as a high-quality PNG
 * and saves it into the device's gallery / Documents under the 'Tinda' album/folder,
 * or shares/downloads it on web platforms.
 */
export async function saveModalToGalleryAsPng(
  elementId: string,
  fileNamePrefix: string = 'tinda-modal'
): Promise<{ success: boolean; message?: string }> {
  try {
    const node = document.getElementById(elementId);
    if (!node) {
      throw new Error('Modal element not found for capture.');
    }

    // Trigger OS storage permission check/request on native platforms
    if (Capacitor.isNativePlatform()) {
      await ensureStoragePermission();
    }

    // Save original styles
    const originalHeight = node.style.height;
    const originalWidth = node.style.width;
    const originalOverflow = node.style.overflow;
    const originalFlex = node.style.flex;
    const originalTransform = node.style.transform;
    
    // Temporarily expand to show full content for capture
    node.style.overflow = 'visible';

    // Recursively find and expand internal scrollable containers
    // Targeting any container with overflow-y-auto or max-height constraints
    const internalScrollContainers = node.querySelectorAll('*');
    const originalChildStyles: { node: HTMLElement; height: string; overflow: string; maxHeight: string; minHeight: string }[] = [];
    
    internalScrollContainers.forEach((el) => {
      const child = el as HTMLElement;
      // If it has scrollable properties, expand it
      if (
        child.scrollHeight > child.clientHeight || 
        child.style.maxHeight || 
        child.classList.contains('overflow-y-auto') ||
        child.classList.contains('max-h-48')
      ) {
        originalChildStyles.push({
          node: child,
          height: child.style.height,
          overflow: child.style.overflow,
          maxHeight: child.style.maxHeight,
          minHeight: child.style.minHeight
        });
        child.style.height = child.scrollHeight + 'px';
        child.style.overflow = 'visible';
        child.style.maxHeight = 'none';
        child.style.minHeight = 'none';
      }
    });

    // CRITICAL: Prevent the parent flex container from squishing the node via flex-shrink
    node.style.flex = 'none';
    node.style.transform = 'none';
    
    // Now that all constraints are removed, calculate the TRUE dimensions
    const trueWidth = node.scrollWidth;
    const trueHeight = node.scrollHeight;
    
    // Force the root node to physically adopt these dimensions
    node.style.width = trueWidth + 'px';
    node.style.height = trueHeight + 'px';

    try {
      // Add a small delay to allow UI to fully render/animate before capture
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Generate high quality PNG data URL from the original node
      const dataUrl = await toPng(node, {
        cacheBust: true,
        quality: 0.95,
        pixelRatio: 2,
        skipFonts: true,
        width: trueWidth,
        height: trueHeight,
        style: {
          flex: 'none',
          maxHeight: 'none',
          margin: '0',
          transform: 'none',
          width: `${trueWidth}px`,
          height: `${trueHeight}px`,
        },
        filter: (domNode) => {
          // Skip cross-origin stylesheet links to prevent CORS cssRules inspection errors
          if (domNode.tagName === 'LINK' && (domNode as HTMLLinkElement).href?.includes('fonts.googleapis.com')) {
            return false;
          }
          return true;
        },
      });

    const base64Data = dataUrl.split(',')[1];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${fileNamePrefix}-${timestamp}.png`;
    const folderName = 'Tinda';

    if (Capacitor.isNativePlatform()) {
      // 1. Ensure directory exists in Documents or external storage
      try {
        await Filesystem.mkdir({
          path: folderName,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (mkdirErr) {
        console.warn('[ModalGallery] mkdir notice:', mkdirErr);
      }

      // 2. Write PNG file into Documents/Tinda/
      const filePath = `${folderName}/${fileName}`;
      const writeResult = await Filesystem.writeFile({
        path: filePath,
        data: base64Data,
        directory: Directory.Documents,
      });

      console.log('[ModalGallery] Saved PNG successfully:', writeResult.uri);

      // 3. Also offer Share option or return success
      try {
        await Share.share({
          title: 'Tinda Modal Export',
          text: 'Here is your saved receipt / QR code from Tinda.',
          url: writeResult.uri,
          dialogTitle: 'Share or Save Tinda Image',
        });
      } catch (shareErr) {
        console.warn('[ModalGallery] Share dialog dismissed or unavailable:', shareErr);
      }

      return {
        success: true,
        message: `Saved to Documents/${folderName}/${fileName}`,
      };
    } else {
      // Web fallback: trigger direct browser download
      const link = document.createElement('a');
      link.download = fileName;
      link.href = dataUrl;
      link.click();

      return {
        success: true,
        message: `Downloaded ${fileName} in browser`,
      };
    }
    } finally {
      node.style.height = originalHeight;
      node.style.width = originalWidth;
      node.style.overflow = originalOverflow;
      node.style.flex = originalFlex;
      node.style.transform = originalTransform;
      
      // Restore child styles
      originalChildStyles.forEach(s => {
        s.node.style.height = s.height;
        s.node.style.overflow = s.overflow;
        s.node.style.maxHeight = s.maxHeight;
        s.node.style.minHeight = s.minHeight;
      });
    }  } catch (error: any) {
    console.error('[ModalGallery] Error saving modal as PNG:', error);
    return {
      success: false,
      message: error?.message || 'Failed to save modal to gallery.',
    };
  }
}
