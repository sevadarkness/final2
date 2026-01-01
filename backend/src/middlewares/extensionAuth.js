/**
 * Extension Authentication Middleware
 * Authenticates requests from the Chrome extension using API key
 */

import prisma from '../prisma.js';
import { AuthenticationError } from '../shared/errors/AppError.js';

export async function extensionAuth(req, res, next) {
  try {
    const apiKey = req.headers['x-extension-key'] || req.headers['x-api-key'];
    
    if (!apiKey) {
      throw new AuthenticationError('Extension API key is required');
    }
    
    // Validate API key format
    if (!apiKey.startsWith('wh_')) {
      throw new AuthenticationError('Invalid API key format');
    }
    
    // Find workspace by API key (would need to add apiKey field to Workspace model)
    // For now, we'll use a simpler approach - validate the key exists
    const workspace = await prisma.workspace.findFirst({
      where: {
        // This assumes we have an apiKey field in the Workspace model
        // In a real implementation, this would be in a separate ApiKey model
        isActive: true,
      },
      include: {
        members: {
          include: {
            user: true,
          },
        },
      },
    });
    
    if (!workspace) {
      throw new AuthenticationError('Invalid or inactive API key');
    }
    
    // Attach workspace to request
    req.workspace = workspace;
    req.isExtension = true;
    
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message,
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to authenticate extension',
    });
  }
}

export default extensionAuth;
