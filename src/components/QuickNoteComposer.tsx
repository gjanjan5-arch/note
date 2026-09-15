import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  StickyNote,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  Check,
  RotateCcw,
  GripHorizontal,
} from 'lucide-react';
import { db, cleanExpiredNotes } from '../db/db';
import type { Note } from '../types';
import { formatDateTime } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';
import { getSavedQuickNoteHeight, saveQuickNoteHeight } from '../utils/storeSettings';

interface QuickNoteComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  lang: LanguageCode;
}

export const QuickNoteComposer: React.FC<QuickNoteComposerProps> = ({
  isOpen,
  onClose,
  onSaved,
  lang,
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isComposing, setIsComposing] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [isAutoDelete, setIsAutoDelete] = useState(false);
  const [timerMinutes, setTimerMinutes] = useState<number>(5);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Height bounds calculation for vertical resizing
  const getBounds = () => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;
    const minH = 260; // minimum usable height to see header + controls
    const maxH = Math.max(minH + 100, Math.min(800, vh - 24));
    const defaultH = Math.max(minH, Math.min(520, Math.round(vh * 0.62)));
    return { minH, maxH, defaultH };
  };

  const [windowHeight, setWindowHeight] = useState<number>(() => {
    const { minH, maxH, defaultH } = getBounds();
    const saved = getSavedQuickNoteHeight();
    if (saved !== null) {
      return Math.max(minH, Math.min(maxH, saved));
    }
    return defaultH;
  });

  // Vertical Resizing State
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(0);
  const currentHeightRef = useRef<number>(windowHeight);
  currentHeightRef.current = windowHeight;

  // Window Movable Position State (offsets from default anchor)
  const [positionOffset, setPositionOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isMoving, setIsMoving] = useState(false);
  const moveStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number }>({
    clientX: 0,
    clientY: 0,
    startX: 0,
    startY: 0,
  });
  const currentOffsetRef = useRef<{ x: number; y: number }>(positionOffset);
  currentOffsetRef.current = positionOffset;

  // Handle window viewport resizes (e.g. rotation / keyboard)
  useEffect(() => {
    const handleResize = () => {
      const { minH, maxH } = getBounds();
      setWindowHeight((prev) => Math.max(minH, Math.min(maxH, prev)));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // When opening, ensure height satisfies bounds
  useEffect(() => {
    if (isOpen) {
      const { minH, maxH, defaultH } = getBounds();
      const saved = getSavedQuickNoteHeight();
      const targetH = saved !== null ? Math.max(minH, Math.min(maxH, saved)) : defaultH;
      setWindowHeight(targetH);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.overscrollBehavior = originalOverscroll || '';
    };
  }, [isOpen]);

  // --- VERTICAL RESIZE HANDLERS ---
  const handleDragStart = (clientY: number) => {
    dragStartYRef.current = clientY;
    dragStartHeightRef.current = currentHeightRef.current;
    setIsDragging(true);
  };

  const handleDragMove = (clientY: number) => {
    const { minH, maxH } = getBounds();
    // Dragging upward (clientY decreases) -> deltaY > 0 -> height increases
    // Dragging downward (clientY increases) -> deltaY < 0 -> height decreases
    const deltaY = dragStartYRef.current - clientY;
    const nextH = Math.max(minH, Math.min(maxH, Math.round(dragStartHeightRef.current + deltaY)));
    currentHeightRef.current = nextH;
    setWindowHeight(nextH);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    saveQuickNoteHeight(currentHeightRef.current);
  };

  // Global window listeners during height resize
  useEffect(() => {
    if (!isDragging) return;

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      handleDragMove(e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientY);
      }
    };

    const onPointerUp = () => {
      handleDragEnd();
    };

    const onTouchEnd = () => {
      handleDragEnd();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isDragging]);

  // --- MOVABLE POSITION DRAG HANDLERS ---
  const handleMoveStart = (clientX: number, clientY: number) => {
    moveStartRef.current = {
      clientX,
      clientY,
      startX: currentOffsetRef.current.x,
      startY: currentOffsetRef.current.y,
    };
    setIsMoving(true);
  };

  const handleMove = (clientX: number, clientY: number) => {
    const deltaX = clientX - moveStartRef.current.clientX;
    const deltaY = clientY - moveStartRef.current.clientY;

    const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 600;

    // Constrain movement within screen bounds
    const maxOffsetLeft = Math.max(100, vw - 120);
    const maxOffsetRight = Math.max(100, vw - 120);
    const maxOffsetUp = Math.max(100, vh - 120);
    const maxOffsetDown = Math.max(100, vh - 120);

    const nextX = Math.max(-maxOffsetLeft, Math.min(maxOffsetRight, moveStartRef.current.startX + deltaX));
    const nextY = Math.max(-maxOffsetUp, Math.min(maxOffsetDown, moveStartRef.current.startY + deltaY));

    const nextOffset = { x: nextX, y: nextY };
    currentOffsetRef.current = nextOffset;
    setPositionOffset(nextOffset);
  };

  const handleMoveEnd = () => {
    setIsMoving(false);
  };

  // Global window listeners during position movement
  useEffect(() => {
    if (!isMoving) return;

    const onPointerMove = (e: PointerEvent) => {
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const onPointerUp = () => {
      handleMoveEnd();
    };

    const onTouchEnd = () => {
      handleMoveEnd();
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isMoving]);

  const handleResetPosition = () => {
    setPositionOffset({ x: 0, y: 0 });
    currentOffsetRef.current = { x: 0, y: 0 };
  };

  // Prevent background scrolling while Mabilisang Tala is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Load notes and periodically clean expired ones
  const fetchNotes = async () => {
    try {
      await cleanExpiredNotes();
      const allNotes = await db.notes.toArray();
      // Sort newest first
      allNotes.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setNotes(allNotes);
      setNow(Date.now());
    } catch (err) {
      console.warn('Error fetching notes:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotes().catch((err) => console.warn('Error fetching notes on open:', err));
      const interval = setInterval(() => {
        setNow(Date.now());
        cleanExpiredNotes()
          .then((cleaned) => {
            if (cleaned > 0) {
              fetchNotes().catch((err) => console.warn('Error fetching notes after clean:', err));
            }
          })
          .catch((err) => {
            console.warn('Error cleaning expired notes:', err);
          });
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const handleStartCreate = () => {
    setEditingNoteId(null);
    setNoteText('');
    setIsAutoDelete(false); // Always permanent by default
    setValidationError(null);
    setIsComposing(true);
  };

  const handleStartEdit = (note: Note) => {
    setEditingNoteId(note.id || null);
    setNoteText(note.text);
    setIsAutoDelete(Boolean(note.autoDelete));
    setValidationError(null);
    setIsComposing(true);
  };

  const handleCancelComposer = () => {
    setIsComposing(false);
    setEditingNoteId(null);
    setNoteText('');
    setIsAutoDelete(false);
    setValidationError(null);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = noteText.trim();
    if (!trimmed) {
      setValidationError(translate(lang, 'note_empty_warning') || 'Please type a note before saving.');
      return;
    }

    try {
      setIsSaving(true);
      setValidationError(null);
      const currentTime = Date.now();

      if (editingNoteId) {
        // Updating existing note
        const existing = notes.find((n) => n.id === editingNoteId);
        let updatedExpiresAt: number | null = null;

        if (isAutoDelete) {
          updatedExpiresAt = currentTime + timerMinutes * 60 * 1000;
        } else {
          // Disabled: permanent
          updatedExpiresAt = null;
        }

        await db.notes.update(editingNoteId, {
          text: trimmed,
          updatedAt: currentTime,
          autoDelete: isAutoDelete,
          expiresAt: updatedExpiresAt,
        });
      } else {
        // Creating new note (permanent by default unless auto-delete is explicitly checked)
        const newNote: Note = {
          text: trimmed,
          createdAt: currentTime,
          updatedAt: currentTime,
          autoDelete: isAutoDelete,
          expiresAt: isAutoDelete ? currentTime + timerMinutes * 60 * 1000 : null,
        };

        await db.notes.add(newNote);
      }

      setIsSaving(false);
      setIsComposing(false);
      setEditingNoteId(null);
      setNoteText('');
      setIsAutoDelete(false);
      await fetchNotes();
      if (onSaved) onSaved();
    } catch (err: any) {
      console.error('Error saving note:', err);
      setValidationError('Failed to save note. Please try again.');
      setIsSaving(false);
    }
  };

  const handleDeleteNote = async (id?: number) => {
    if (!id) return;
    try {
      await db.notes.delete(id);
      await fetchNotes();
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleToggleAutoDelete = async (note: Note) => {
    if (!note.id) return;
    try {
      const currentTime = Date.now();
      const willEnable = !note.autoDelete;

      await db.notes.update(note.id, {
        autoDelete: willEnable,
        // When enabling: starts 30-minute countdown from this exact moment
        expiresAt: willEnable ? currentTime + 30 * 60 * 1000 : null,
        updatedAt: currentTime,
      });

      await fetchNotes();
      if (onSaved) onSaved();
    } catch (err) {
      console.error('Error toggling auto delete:', err);
    }
  };

  const hasMoved = positionOffset.x !== 0 || positionOffset.y !== 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="mabilisang-tala-backdrop"
          id="mabilisang-tala-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          onTouchMove={(e) => {
            // Block touch scrolling on underlying application
            e.preventDefault();
          }}
          className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-xs select-none pointer-events-auto"
          aria-hidden="true"
        />
      )}
      {isOpen && (
        <motion.div
          key="mabilisang-tala-modal-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          id="mabilisang-tala-modal-container"
          className="fixed inset-0 pointer-events-none z-50 flex items-end justify-center sm:justify-end p-0 sm:pb-4 sm:pr-4 overflow-hidden select-none"
        >
          <motion.div
            key="mabilisang-tala-sheet"
            id="mabilisang-tala-sheet"
              initial={{ y: 80, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 80, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: `${windowHeight}px`,
                maxHeight: 'calc(100dvh - 24px)',
                transform: `translate3d(${positionOffset.x}px, ${positionOffset.y}px, 0)`,
                transition: isDragging || isMoving ? 'none' : 'height 0.15s ease-out',
              }}
              className={`pointer-events-auto theme-card rounded-t-3xl sm:rounded-3xl w-full sm:w-[420px] max-w-full shadow-2xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden ${
                isDragging || isMoving ? 'select-none ring-2 ring-[var(--color-primary)]/40' : ''
              }`}
            >
            {/* Top Drag Handle for Smooth Vertical Resizing */}
            <div
              id="mabilisang-tala-drag-handle"
              role="slider"
              aria-label={translate(lang, 'drag_handle_resize')}
              aria-valuenow={windowHeight}
              aria-valuemin={260}
              aria-valuemax={typeof window !== 'undefined' ? window.innerHeight - 24 : 800}
              tabIndex={0}
              onPointerDown={(e) => {
                if (e.button === 0 || e.pointerType === 'touch') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDragStart(e.clientY);
                }
              }}
              onTouchStart={(e) => {
                if (e.touches.length > 0) {
                  e.stopPropagation();
                  handleDragStart(e.touches[0].clientY);
                }
              }}
              onKeyDown={(e) => {
                const { minH, maxH } = getBounds();
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const nextH = Math.min(maxH, windowHeight + 30);
                  setWindowHeight(nextH);
                  saveQuickNoteHeight(nextH);
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const nextH = Math.max(minH, windowHeight - 30);
                  setWindowHeight(nextH);
                  saveQuickNoteHeight(nextH);
                }
              }}
              title={translate(lang, 'drag_handle_resize')}
              style={{ touchAction: 'none' }}
              className="w-full pt-3 pb-2 px-4 flex flex-col items-center justify-center cursor-ns-resize touch-none select-none group focus:outline-none shrink-0"
            >
              <div
                className={`w-14 h-1.5 rounded-full transition-all duration-150 shadow-2xs ${
                  isDragging
                    ? 'bg-[var(--color-primary)] scale-y-125'
                    : 'bg-zinc-300/80 dark:bg-zinc-600/80 group-hover:bg-[var(--color-primary)] group-hover:scale-x-110'
                }`}
              />
            </div>

            {/* Header / Move Bar */}
            <div
              onPointerDown={(e) => {
                // Allow moving when grabbing the header (except clicking buttons or interactive elements)
                const target = e.target as HTMLElement;
                if (!target.closest('button') && !target.closest('input') && !target.closest('textarea')) {
                  e.preventDefault();
                  handleMoveStart(e.clientX, e.clientY);
                }
              }}
              onTouchStart={(e) => {
                const target = e.target as HTMLElement;
                if (!target.closest('button') && !target.closest('input') && !target.closest('textarea')) {
                  if (e.touches.length > 0) {
                    handleMoveStart(e.touches[0].clientX, e.touches[0].clientY);
                  }
                }
              }}
              className="flex items-center justify-between border-b theme-border-subtle px-4 sm:px-5 pb-2.5 shrink-0 cursor-grab active:cursor-grabbing select-none"
              title="Drag to move floating window"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl theme-bg-primary text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <StickyNote className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-xs sm:text-sm font-black theme-text-app">
                      {translate(lang, 'mabilisang_tala')}
                    </h2>
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md theme-bg-surface-subtle theme-text-secondary border theme-border-subtle">
                      {notes.length}
                    </span>
                  </div>
                  <p className="text-[10px] theme-text-secondary font-medium">
                    {translate(lang, 'quick_note_prompt')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Reset position button if dragged */}
                {hasMoved && (
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    transition={{ duration: 0.1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResetPosition();
                    }}
                    className="w-7 h-7 rounded-lg theme-bg-surface-subtle theme-text-secondary hover:theme-text-app flex items-center justify-center transition-colors"
                    title="Reset window position"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </motion.button>
                )}

                {/* Move Grip Indicator */}
                <div
                  className="w-7 h-7 rounded-lg theme-bg-surface-subtle theme-text-secondary flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                  title="Drag header to move window"
                >
                  <GripHorizontal className="w-4 h-4" />
                </div>

                {/* Close Button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="w-7 h-7 rounded-lg theme-bg-surface-subtle theme-text-secondary hover:theme-text-app flex items-center justify-center transition-colors"
                  title={translate(lang, 'close')}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Body Content: Switch between Composer View and Notes List with Independent Scrolling */}
            <div className="overflow-y-auto overscroll-contain px-4 sm:px-5 pt-3 pb-4 sm:pb-5 space-y-3.5 flex-1 min-h-0 select-text">
              {isComposing ? (
                /* Composer & Edit Form */
                <form onSubmit={handleSave} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold theme-text-app flex items-center gap-1.5">
                      {editingNoteId ? (
                        <>
                          <Pencil className="w-3.5 h-3.5 theme-text-accent" />
                          <span>{translate(lang, 'edit_product') || 'Edit Note'}</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5 theme-text-accent" />
                          <span>{translate(lang, 'btn_new_note')}</span>
                        </>
                      )}
                    </span>
                    {notes.length > 0 && (
                      <button
                        type="button"
                        onClick={handleCancelComposer}
                        className="text-xs font-semibold theme-text-secondary hover:theme-text-app transition-colors"
                      >
                        {translate(lang, 'saved_notes_title')} ({notes.length})
                      </button>
                    )}
                  </div>

                  <div>
                    <textarea
                      autoFocus
                      value={noteText}
                      onChange={(e) => {
                        setNoteText(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      rows={3}
                      placeholder={translate(lang, 'quick_note_placeholder')}
                      className="w-full theme-input rounded-2xl p-3 text-xs sm:text-sm theme-text-app border font-medium focus:outline-none resize-none leading-relaxed transition-colors duration-150"
                    />
                    {validationError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className="mt-2 text-xs text-red-400 flex items-center gap-1.5 font-medium"
                      >
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{validationError}</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Auto-delete Checkbox Option & Timer Presets */}
                  <div
                    className={`p-2.5 rounded-2xl border space-y-2 transition-all duration-150 ${
                      isAutoDelete
                        ? 'theme-bg-surface border-amber-500/30'
                        : 'theme-bg-surface-subtle theme-border-subtle'
                    }`}
                  >
                    <label
                      htmlFor="note-auto-delete-toggle"
                      className="flex items-start gap-2.5 cursor-pointer select-none"
                    >
                      <input
                        id="note-auto-delete-toggle"
                        type="checkbox"
                        checked={isAutoDelete}
                        onChange={(e) => setIsAutoDelete(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded border-gray-400 text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer transition-transform duration-100 active:scale-90"
                      />
                      <div className="text-xs theme-text-app">
                        <div className="flex items-center gap-1.5 font-bold">
                          <Clock
                            className={`w-3.5 h-3.5 transition-colors duration-150 ${
                              isAutoDelete ? 'text-amber-400' : 'theme-text-accent'
                            }`}
                          />
                          <span>{lang === 'tl' ? 'Lagyan ng Timer / Auto-delete' : 'Set Timer / Auto-delete'}</span>
                        </div>
                        <p className="text-[10.5px] theme-text-secondary font-medium mt-0.5">
                          {translate(lang, 'auto_delete_hint')}
                        </p>
                      </div>
                    </label>

                    {/* Duration Pills when Auto-Delete is active */}
                    {isAutoDelete && (
                      <div className="pt-2 border-t border-amber-500/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        <span className="text-[10px] font-bold theme-text-secondary shrink-0">
                          {lang === 'tl' ? 'Oras:' : 'Timer:'}
                        </span>
                        {[
                          { mins: 5, label: '⚡ 5m (Express)' },
                          { mins: 15, label: '15m' },
                          { mins: 30, label: '30m' },
                          { mins: 60, label: '1h' },
                        ].map((preset) => (
                          <button
                            key={preset.mins}
                            type="button"
                            onClick={() => setTimerMinutes(preset.mins)}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all shrink-0 active:scale-95 cursor-pointer ${
                              timerMinutes === preset.mins
                                ? 'bg-amber-500 text-slate-950 shadow-xs'
                                : 'theme-bg-surface-subtle theme-text-secondary hover:theme-text-app'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Composer Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t theme-border-subtle">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      type="button"
                      onClick={handleCancelComposer}
                      className="px-3.5 py-2 rounded-xl theme-text-secondary hover:bg-white/10 text-xs font-bold transition-colors"
                    >
                      {translate(lang, 'btn_cancel')}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      type="submit"
                      disabled={isSaving}
                      className="theme-bg-primary hover:opacity-95 text-white font-extrabold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs disabled:opacity-50 transition-opacity"
                    >
                      <CheckCircle2 className="w-4 h-4 text-white/90" />
                      <span>
                        {editingNoteId
                          ? translate(lang, 'btn_update_note')
                          : translate(lang, 'btn_save_note')}
                      </span>
                    </motion.button>
                  </div>
                </form>
              ) : (
                /* Notes List View */
                <div className="space-y-3">
                  {/* Top Action Bar: Create Note Button */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold theme-text-app">
                      {translate(lang, 'saved_notes_title')}
                    </span>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      transition={{ duration: 0.1 }}
                      onClick={handleStartCreate}
                      className="theme-bg-primary hover:opacity-95 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-2xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{translate(lang, 'btn_new_note')}</span>
                    </motion.button>
                  </div>

                  {notes.length === 0 ? (
                    <div className="theme-card rounded-2xl p-5 text-center border border-dashed theme-border theme-text-secondary space-y-2">
                      <StickyNote className="w-7 h-7 mx-auto opacity-40" />
                      <p className="text-xs font-bold theme-text-app">
                        {translate(lang, 'no_notes_yet')}
                      </p>
                      <p className="text-[11px] theme-text-secondary">
                        {translate(lang, 'no_notes_desc')}
                      </p>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        onClick={handleStartCreate}
                        className="mt-1.5 text-xs font-black theme-text-accent hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{translate(lang, 'btn_new_note')}</span>
                      </motion.button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {notes.map((note) => {
                        const minutesLeft =
                          note.autoDelete && note.expiresAt && note.expiresAt > now
                            ? Math.max(1, Math.ceil((note.expiresAt - now) / 60000))
                            : null;

                        return (
                          <motion.div
                            key={note.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="theme-card rounded-2xl p-3 border hover:border-[var(--color-primary)] transition-all space-y-2"
                          >
                            {/* Note Text */}
                            <p className="text-xs sm:text-sm font-medium theme-text-app whitespace-pre-wrap leading-relaxed">
                              {note.text}
                            </p>

                            {/* Card Footer: Metadata & Actions */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t theme-border-subtle flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Expiration / Auto-delete Pill Toggle */}
                                {note.autoDelete ? (
                                  <button
                                    onClick={() => handleToggleAutoDelete(note)}
                                    title="Click to disable auto-delete (make permanent)"
                                    className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-500/15 text-amber-400 dark:text-amber-300 hover:bg-amber-500/25 px-2 py-0.5 rounded-lg border border-amber-500/30 transition-colors"
                                  >
                                    <Clock className="w-3 h-3" />
                                    <span>
                                      {minutesLeft !== null
                                        ? minutesLeft <= 1
                                          ? lang === 'tl'
                                            ? '< 1m nalalabi'
                                            : '< 1m left'
                                          : lang === 'tl'
                                          ? `${minutesLeft}m nalalabi`
                                          : `${minutesLeft}m left`
                                        : lang === 'tl'
                                        ? 'Mag-e-expire'
                                        : 'Expiring'}
                                    </span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleToggleAutoDelete(note)}
                                    title="Click to enable 30-minute auto-delete"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold theme-bg-surface-subtle theme-text-secondary hover:theme-text-app px-2 py-0.5 rounded-lg border theme-border-subtle transition-colors"
                                  >
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>{translate(lang, 'permanent_note')}</span>
                                  </button>
                                )}

                                <span className="text-[10px] font-medium theme-text-secondary">
                                  {formatDateTime(note.createdAt)}
                                </span>
                              </div>

                              {/* Edit & Delete Note Actions */}
                              <div className="flex items-center gap-1 ml-auto">
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  transition={{ duration: 0.1 }}
                                  onClick={() => handleStartEdit(note)}
                                  className="p-1.5 rounded-lg theme-text-secondary hover:theme-text-app hover:bg-white/10 transition-colors"
                                  title="Edit note"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </motion.button>
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  transition={{ duration: 0.1 }}
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="p-1.5 rounded-lg theme-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                  title="Delete note"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </motion.button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
