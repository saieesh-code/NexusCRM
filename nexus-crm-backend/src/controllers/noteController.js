/**
 * Notes Controller
 * Manages follow-up notes embedded in lead documents
 */

'use strict';

const Lead = require('../models/Lead');
const { AppError } = require('../middleware/errorMiddleware');
const { logActivity } = require('../utils/activityLogger');

// ─── GET /api/v1/leads/:id/notes ──────────────────────────────────────────────
exports.getNotes = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id).select('notes fullName').lean();
    if (!lead) return next(new AppError('Lead not found.', 404));

    // Sort notes newest first
    const notes = [...(lead.notes || [])].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({
      success: true,
      count: notes.length,
      data: notes,
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/v1/leads/:id/notes ─────────────────────────────────────────────
exports.addNote = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return next(new AppError('Lead not found.', 404));

    const note = {
      content: req.body.content.trim(),
      createdBy: req.user._id,
      createdByName: req.user.name,
    };

    lead.notes.unshift(note); // Prepend so newest is first
    lead.updatedAt = new Date();
    await lead.save();

    await logActivity({
      action: 'note_added',
      description: `Note added to lead: ${lead.fullName}`,
      performedBy: req.user,
      lead,
      metadata: { noteLength: note.content.length },
      req,
    });

    // Return just the new note (first element after unshift)
    const addedNote = lead.notes[0];

    res.status(201).json({
      success: true,
      data: addedNote,
      message: 'Note added successfully.',
    });
  } catch (err) {
    next(err);
  }
};

// ─── DELETE /api/v1/leads/:id/notes/:noteId ───────────────────────────────────
exports.deleteNote = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return next(new AppError('Lead not found.', 404));

    const noteIndex = lead.notes.findIndex(
      (n) => n._id.toString() === req.params.noteId
    );

    if (noteIndex === -1) {
      return next(new AppError('Note not found.', 404));
    }

    const note = lead.notes[noteIndex];

    // Only the note author or admin/manager can delete
    const isAuthor = note.createdBy?.toString() === req.user._id.toString();
    const isPrivileged = ['admin', 'manager'].includes(req.user.role);

    if (!isAuthor && !isPrivileged) {
      return next(new AppError('You can only delete your own notes.', 403));
    }

    lead.notes.splice(noteIndex, 1);
    await lead.save();

    await logActivity({
      action: 'note_deleted',
      description: `Note deleted from lead: ${lead.fullName}`,
      performedBy: req.user,
      lead,
      req,
    });

    res.json({ success: true, message: 'Note deleted.' });
  } catch (err) {
    next(err);
  }
};

// ─── PUT /api/v1/leads/:id/notes/:noteId ─────────────────────────────────────
exports.updateNote = async (req, res, next) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return next(new AppError('Lead not found.', 404));

    const note = lead.notes.id(req.params.noteId);
    if (!note) return next(new AppError('Note not found.', 404));

    // Only note author can edit
    if (note.createdBy?.toString() !== req.user._id.toString()) {
      return next(new AppError('You can only edit your own notes.', 403));
    }

    note.content = req.body.content.trim();
    await lead.save();

    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
};
