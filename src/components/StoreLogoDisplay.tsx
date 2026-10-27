import React, { useState, useEffect } from 'react';
import { db } from '../db/db';
import { Camera } from 'lucide-react';

interface StoreLogoDisplayProps {
  logoAssetId?: number;
  storeName: string;
  className?: string;
}

export const StoreLogoDisplay: React.FC<StoreLogoDisplayProps> = ({ logoAssetId, storeName, className = "w-11 h-11" }) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (logoAssetId) {
      db.storeAssets.get(logoAssetId).then((asset) => {
        if (asset) {
          objectUrl = URL.createObjectURL(asset.data);
          setLogoUrl(objectUrl);
        } else {
          setLogoUrl(null);
        }
      }).catch(() => setLogoUrl(null));
    } else {
      setLogoUrl(null);
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [logoAssetId]);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={storeName || 'Store Logo'}
        className={`${className} rounded-2xl object-cover border border-emerald-500/30 shadow-xs`}
      />
    );
  }

  // Default initial badge
  return (
    <div className={`${className} rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-xs select-none`}>
      {(storeName?.trim()?.charAt(0) || 'T').toUpperCase()}
    </div>
  );
};
