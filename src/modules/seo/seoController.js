const SeoMeta = require('./seoMetaModel');
const logger = require('../../config/logger');

class SeoController {
  /**
   * Get all SEO meta tags
   */
  async getAllSeoMeta(req, res) {
    try {
    
      
      const seoMetas = await SeoMeta.find({});
      
      res.status(200).json({
        success: true,
        count: seoMetas.length,
        data: seoMetas
      });
    } catch (error) {
      logger.error('Error fetching SEO meta tags:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching SEO meta tags',
        error: error.message
      });
    }
  }

  /**
   * Get SEO meta by page type
   */
  async getSeoMetaByPageType(req, res) {
    try {
      const { pageType } = req.params;
      const { dynamicValues } = req.query;
      
      const seoMeta = await SeoMeta.findOne({ 
        pageType, 
        isActive: true 
      });
      
      if (!seoMeta) {
        return res.status(404).json({
          success: false,
          message: `SEO meta not found for page type: ${pageType}`
        });
      }
      
      // If dynamic values provided, render the meta tags
      let responseData = seoMeta;
      if (dynamicValues) {
        try {
          const parsedValues = JSON.parse(dynamicValues);
          responseData = seoMeta.renderMetaTags(parsedValues);
        } catch (parseError) {
          logger.warn('Error parsing dynamic values:', parseError);
        }
      }
      
      res.status(200).json({
        success: true,
        data: responseData
      });
    } catch (error) {
      logger.error('Error fetching SEO meta by page type:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching SEO meta',
        error: error.message
      });
    }
  }

  /**
   * Create new SEO meta
   */
  async createSeoMeta(req, res) {
    try {
      const seoMetaData = req.body;
      
      // Add creator info
      if (req.user) {
        seoMetaData.createdBy = req.user.email || req.user._id;
        seoMetaData.updatedBy = req.user.email || req.user._id;
      }
      
      const seoMeta = new SeoMeta(seoMetaData);
      await seoMeta.save();
      
      logger.info(`SEO meta created for page type: ${seoMeta.pageType}`);
      
      res.status(201).json({
        success: true,
        message: 'SEO meta created successfully',
        data: seoMeta
      });
    } catch (error) {
      logger.error('Error creating SEO meta:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'SEO meta already exists for this page type'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating SEO meta',
        error: error.message
      });
    }
  }

  /**
   * Update SEO meta by page type
   */
  async updateSeoMeta(req, res) {
    try {
      const { pageType } = req.params;
      const updateData = req.body;
      
      // Add updater info
      if (req.user) {
        updateData.updatedBy = req.user.email || req.user._id;
      }
      
      // Prevent changing pageType
      delete updateData.pageType;
      
      const seoMeta = await SeoMeta.findOneAndUpdate(
        { pageType },
        updateData,
        { new: true, runValidators: true }
      );
      
      if (!seoMeta) {
        return res.status(404).json({
          success: false,
          message: `SEO meta not found for page type: ${pageType}`
        });
      }
      
      logger.info(`SEO meta updated for page type: ${pageType}`);
      
      res.status(200).json({
        success: true,
        message: 'SEO meta updated successfully',
        data: seoMeta
      });
    } catch (error) {
      logger.error('Error updating SEO meta:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating SEO meta',
        error: error.message
      });
    }
  }

  /**
   * Delete SEO meta by page type
   */
  async deleteSeoMeta(req, res) {
    try {
      const { pageType } = req.params;
      
      const seoMeta = await SeoMeta.findOneAndDelete({ pageType });
      
      if (!seoMeta) {
        return res.status(404).json({
          success: false,
          message: `SEO meta not found for page type: ${pageType}`
        });
      }
      
      logger.info(`SEO meta deleted for page type: ${pageType}`);
      
      res.status(200).json({
        success: true,
        message: 'SEO meta deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting SEO meta:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting SEO meta',
        error: error.message
      });
    }
  }

  /**
   * Render meta tags with dynamic values (for frontend use)
   */
  async renderMetaTags(req, res) {
    try {
      const { pageType } = req.params;
      const dynamicValues = req.body;
      
      const seoMeta = await SeoMeta.findOne({ 
        pageType, 
        isActive: true 
      });
      
      if (!seoMeta) {
        return res.status(404).json({
          success: false,
          message: `SEO meta not found for page type: ${pageType}`
        });
      }
      
      const renderedMeta = seoMeta.renderMetaTags(dynamicValues);
      
      res.status(200).json({
        success: true,
        data: renderedMeta
      });
    } catch (error) {
      logger.error('Error rendering meta tags:', error);
      res.status(500).json({
        success: false,
        message: 'Error rendering meta tags',
        error: error.message
      });
    }
  }

  /**
   * Toggle SEO meta active status
   */
  async toggleSeoMetaStatus(req, res) {
    try {
      const { pageType } = req.params;
      const { isActive } = req.body;
      
      const seoMeta = await SeoMeta.findOneAndUpdate(
        { pageType },
        { 
          isActive,
          updatedBy: req.user ? (req.user.email || req.user._id) : 'system'
        },
        { new: true }
      );
      
      if (!seoMeta) {
        return res.status(404).json({
          success: false,
          message: `SEO meta not found for page type: ${pageType}`
        });
      }
      
      logger.info(`SEO meta status toggled for page type: ${pageType} to ${isActive}`);
      
      res.status(200).json({
        success: true,
        message: `SEO meta ${isActive ? 'activated' : 'deactivated'} successfully`,
        data: seoMeta
      });
    } catch (error) {
      logger.error('Error toggling SEO meta status:', error);
      res.status(500).json({
        success: false,
        message: 'Error toggling SEO meta status',
        error: error.message
      });
    }
  }

  /**
   * Bulk update SEO metas
   */
  async bulkUpdateSeoMeta(req, res) {
    try {
      const { updates } = req.body; // Array of { pageType, data }
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Updates array is required'
        });
      }
      
      const results = [];
      const errors = [];
      
      for (const update of updates) {
        try {
          const { pageType, ...data } = update;
          
          if (req.user) {
            data.updatedBy = req.user.email || req.user._id;
          }
          
          const seoMeta = await SeoMeta.findOneAndUpdate(
            { pageType },
            data,
            { new: true, runValidators: true }
          );
          
          if (seoMeta) {
            results.push({ pageType, success: true });
          } else {
            errors.push({ pageType, error: 'Not found' });
          }
        } catch (error) {
          errors.push({ pageType: update.pageType, error: error.message });
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Bulk update completed',
        results,
        errors
      });
    } catch (error) {
      logger.error('Error in bulk update:', error);
      res.status(500).json({
        success: false,
        message: 'Error in bulk update',
        error: error.message
      });
    }
  }
}

module.exports = new SeoController();
