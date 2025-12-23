/**
 * Automation Routes
 * Routes for voicemail drop, SMS follow-up, and callback automation
 */

const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================
// SMS TEMPLATES
// ============================================

/**
 * @route   GET /api/automation/sms-templates
 * @desc    Get all SMS templates for current user
 * @access  Private
 */
router.get('/sms-templates', automationController.getSmsTemplates);

/**
 * @route   POST /api/automation/sms-templates
 * @desc    Create a new SMS template
 * @access  Private
 */
router.post('/sms-templates', automationController.createSmsTemplate);

/**
 * @route   PUT /api/automation/sms-templates/:id
 * @desc    Update an SMS template
 * @access  Private
 */
router.put('/sms-templates/:id', automationController.updateSmsTemplate);

/**
 * @route   DELETE /api/automation/sms-templates/:id
 * @desc    Delete an SMS template
 * @access  Private
 */
router.delete('/sms-templates/:id', automationController.deleteSmsTemplate);

/**
 * @route   POST /api/automation/sms-templates/:id/default
 * @desc    Set an SMS template as default
 * @access  Private
 */
router.post('/sms-templates/:id/default', automationController.setDefaultSmsTemplate);

// ============================================
// AUTOMATION SETTINGS
// ============================================

/**
 * @route   GET /api/automation/settings
 * @desc    Get automation settings for current user
 * @access  Private
 */
router.get('/settings', automationController.getAutomationSettings);

/**
 * @route   PUT /api/automation/settings
 * @desc    Update automation settings
 * @access  Private
 */
router.put('/settings', automationController.updateAutomationSettings);

// ============================================
// SMS SENDING
// ============================================

/**
 * @route   POST /api/automation/sms/send
 * @desc    Send an SMS manually
 * @access  Private
 */
router.post('/sms/send', automationController.sendSms);

/**
 * @route   GET /api/automation/sms/logs
 * @desc    Get SMS logs
 * @access  Private
 */
router.get('/sms/logs', automationController.getSmsLogs);

// ============================================
// VOICEMAIL DROP
// ============================================

/**
 * @route   POST /api/automation/voicemail/drop
 * @desc    Drop voicemail with optional SMS follow-up
 * @access  Private
 */
router.post('/voicemail/drop', automationController.dropVoicemailWithFollowup);

// ============================================
// SCHEDULED CALLBACKS
// ============================================

/**
 * @route   GET /api/automation/callbacks
 * @desc    Get scheduled callbacks
 * @access  Private
 */
router.get('/callbacks', automationController.getScheduledCallbacks);

/**
 * @route   POST /api/automation/callbacks
 * @desc    Schedule a new callback
 * @access  Private
 */
router.post('/callbacks', automationController.scheduleCallback);

/**
 * @route   PUT /api/automation/callbacks/:id
 * @desc    Update a callback (status, notes)
 * @access  Private
 */
router.put('/callbacks/:id', automationController.updateCallback);

// ============================================
// STATS
// ============================================

/**
 * @route   GET /api/automation/stats
 * @desc    Get automation statistics
 * @access  Private
 */
router.get('/stats', automationController.getAutomationStats);

module.exports = router;
