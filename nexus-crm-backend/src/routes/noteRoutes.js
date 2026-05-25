/**
 * Note Routes — /api/v1/leads/:id/notes
 */

'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });

const noteController = require('../controllers/noteController');
const { protect } = require('../middleware/authMiddleware');
const { noteValidator, leadIdValidator } = require('../middleware/validationMiddleware');
const { param } = require('express-validator');

router.use(protect);

router
  .route('/:id/notes')
  .get(leadIdValidator, noteController.getNotes)
  .post(noteValidator, noteController.addNote);

router
  .route('/:id/notes/:noteId')
  .put(
    leadIdValidator,
    [param('noteId').isMongoId().withMessage('Invalid note ID')],
    noteController.updateNote
  )
  .delete(
    leadIdValidator,
    [param('noteId').isMongoId().withMessage('Invalid note ID')],
    noteController.deleteNote
  );

module.exports = router;
