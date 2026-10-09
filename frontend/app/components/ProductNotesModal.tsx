'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Plus } from 'lucide-react'
import { productNotes } from '@/app/lib/api'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { noteSchema, type NoteFormValues } from '@/app/lib/schemas'
import { FieldError } from '@/app/components/ui/field-error'

interface Note {
  note_id: string
  product_id: string
  admin_id: string | null
  admin_name: string | null
  note_text: string
  created_at: string
  updated_at: string
}

interface NotesModalProps {
  productId: string
  isOpen: boolean
  onClose: () => void
  isAdmin: boolean
}

export default function NotesModal({ productId, isOpen, onClose, isAdmin }: NotesModalProps) {
  const [notes, setNotes] = useState<Note[]>([])
  // Two small forms: one for adding a note, one for editing the note currently open.
  const addForm = useForm<NoteFormValues>({ resolver: zodResolver(noteSchema), defaultValues: { note_text: '' } })
  const editForm = useForm<NoteFormValues>({ resolver: zodResolver(noteSchema), defaultValues: { note_text: '' } })
  const newNoteText = addForm.watch('note_text')
  const [loading, setLoading] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchNotes()
    }
  }, [isOpen, productId])

  const fetchNotes = async () => {
    try {
      setLoading(true)
      const data = await productNotes.getByProductId(productId)
      setNotes(data)
    } catch (error: unknown) {
      if ((error as { status?: number }).status !== 401) {
        toast.error('Failed to load notes')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleAddNote = async (values: NoteFormValues) => {
    try {
      setLoading(true)
      await productNotes.create(productId, values.note_text)
      addForm.reset()
      await fetchNotes()
      toast.success('Note added successfully')
    } catch (error: unknown) {
      if ((error as { status?: number }).status !== 401) {
        toast.error('Failed to add note')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateNote = async (noteId: string, values: NoteFormValues) => {
    try {
      setLoading(true)
      await productNotes.update(productId, noteId, values.note_text)
      setEditingNoteId(null)
      editForm.reset()
      await fetchNotes()
      toast.success('Note updated successfully')
    } catch (error: unknown) {
      if ((error as { status?: number }).status !== 401) {
        toast.error('Failed to update note')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return
    }

    try {
      setLoading(true)
      await productNotes.delete(productId, noteId)
      await fetchNotes()
      toast.success('Note deleted successfully')
    } catch (error: unknown) {
      if ((error as { status?: number }).status !== 401) {
        toast.error('Failed to delete note')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Product Notes</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Existing Notes */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-800">Notes ({notes.length})</h3>
            {notes.length === 0 ? (
              <p className="text-gray-500 text-sm">No notes yet</p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.note_id}
                  className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition"
                >
                  {editingNoteId === note.note_id ? (
                    <div className="space-y-2">
                      <textarea
                        {...editForm.register('note_text')}
                        className="w-full text-black p-2 border border-gray-300 rounded text-sm focus:outline-none focus:border-green-500 resize-none"
                        rows={3}
                      />
                      <FieldError error={editForm.formState.errors.note_text} />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="px-3 text-black py-1 text-sm border border-gray-300 rounded hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={editForm.handleSubmit((values) => handleUpdateNote(note.note_id, values))}
                          disabled={loading}
                          className="px-3 py-1 text-sm bg-linear-to-r from-[#13452D] to-[#1F764D] text-white rounded hover:opacity-90 transition disabled:opacity-50"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-900 text-sm">{note.note_text}</p>
                      <div className="mt-2 flex justify-between items-center">
                        <div className="text-xs text-gray-500 space-y-0.5">
                          <p>By: {note.admin_name || 'Admin'}</p>
                          <p>
                            {new Date(note.created_at).toLocaleDateString()} •{' '}
                            {new Date(note.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setEditingNoteId(note.note_id)
                                editForm.reset({ note_text: note.note_text })
                              }}
                              className="text-sm text-black px-2 py-1 border border-gray-300 rounded hover:bg-gray-200 transition"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.note_id)}
                              className="text-red-500 hover:text-red-700 transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Add New Note Section */}
          {isAdmin && (
            <div className="border-t border-gray-200 pt-4 mt-6">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Plus size={18} />
                Add New Note
              </h3>
              <textarea
                {...addForm.register('note_text')}
                placeholder="Enter your note here..."
                className="w-full p-3 text-black border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-green-500 resize-none"
                rows={3}
              />
              <FieldError error={addForm.formState.errors.note_text} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-end gap-3 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-black border border-gray-300 rounded-lg hover:bg-gray-100 transition font-medium"
          >
            Close
          </button>
          {isAdmin && (
            <button
              onClick={addForm.handleSubmit(handleAddNote)}
              disabled={loading || !newNoteText.trim()}
              className="px-4 py-2 bg-linear-to-r from-[#13452D] to-[#1F764D] text-white rounded-lg hover:opacity-90 transition disabled:opacity-50 font-medium shadow-sm"
            >
              {loading ? 'Saving...' : 'Save Note'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
