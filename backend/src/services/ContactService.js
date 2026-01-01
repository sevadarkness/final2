/**
 * Contact Service
 * Complete CRM contact management with labels, import/export, timeline
 */

import prisma from '../prisma.js';
import { NotFoundError, ConflictError, ValidationError } from '../shared/errors/AppError.js';
import { formatPaginatedResponse, parsePagination, createSearchFilter } from '../shared/utils/pagination.js';
import { normalizePhone, toWhatsAppId } from '../shared/utils/phone.js';
import { isValidPhone, isValidEmail } from '../shared/utils/validators.js';

class ContactService {
  async listContacts(workspaceId, filters = {}, pagination = {}) {
    const { skip, take, page, perPage } = parsePagination(pagination);
    const { search, stage, labels, minScore, maxScore, sortBy = 'createdAt', order = 'desc' } = filters;
    
    const where = {
      workspaceId,
      deletedAt: null,
      ...(stage && { stage }),
      ...(minScore !== undefined && { leadScore: { gte: parseInt(minScore) } }),
      ...(maxScore !== undefined && { leadScore: { lte: parseInt(maxScore) } }),
      ...(labels && labels.length > 0 && {
        labels: {
          some: {
            labelId: { in: labels },
          },
        },
      }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { company: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take,
        include: {
          labels: {
            include: {
              label: true,
            },
          },
          _count: {
            select: {
              messages: true,
              activities: true,
              deals: true,
            },
          },
        },
        orderBy: { [sortBy]: order },
      }),
      prisma.contact.count({ where }),
    ]);
    
    return formatPaginatedResponse(contacts, total, { page, perPage });
  }
  
  async getContactById(contactId, workspaceId) {
    const contact = await prisma.contact.findFirst({
      where: {
        id: contactId,
        workspaceId,
        deletedAt: null,
      },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
        deals: {
          include: {
            pipeline: true,
            stage: true,
          },
        },
        _count: {
          select: {
            messages: true,
            activities: true,
          },
        },
      },
    });
    
    if (!contact) {
      throw new NotFoundError('Contact');
    }
    
    return contact;
  }
  
  async getContactTimeline(contactId, workspaceId, pagination = {}) {
    const { skip, take, page, perPage } = parsePagination(pagination);
    
    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: {
          contactId,
          workspaceId,
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      }),
      prisma.activity.count({
        where: { contactId, workspaceId },
      }),
    ]);
    
    return formatPaginatedResponse(activities, total, { page, perPage });
  }
  
  async createContact(data, workspaceId, userId) {
    const { name, phone, email, company, position, notes, labels, customFields } = data;
    
    // Validate phone number
    if (!isValidPhone(phone)) {
      throw new ValidationError('Invalid phone number format');
    }
    
    const normalizedPhone = normalizePhone(phone);
    const whatsappId = toWhatsAppId(phone);
    
    // Check for duplicates
    const existing = await prisma.contact.findFirst({
      where: {
        workspaceId,
        OR: [
          { phone: normalizedPhone },
          { whatsappId },
          ...(email ? [{ email }] : []),
        ],
        deletedAt: null,
      },
    });
    
    if (existing) {
      throw new ConflictError('Contact with this phone or email already exists');
    }
    
    // Create contact
    const contact = await prisma.contact.create({
      data: {
        workspaceId,
        name,
        phone: normalizedPhone,
        whatsappId,
        email,
        company,
        position,
        notes,
        customFields,
        stage: 'new',
        leadScore: 50,
        ...(labels && labels.length > 0 && {
          labels: {
            create: labels.map(labelId => ({
              labelId,
              assignedBy: userId,
            })),
          },
        }),
      },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
      },
    });
    
    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId,
        contactId: contact.id,
        userId,
        type: 'contact_created',
        description: `Contact ${name} created`,
      },
    });
    
    return contact;
  }
  
  async updateContact(contactId, data, workspaceId, userId) {
    const contact = await this.getContactById(contactId, workspaceId);
    
    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        ...data,
        ...(data.phone && {
          phone: normalizePhone(data.phone),
          whatsappId: toWhatsAppId(data.phone),
        }),
      },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
      },
    });
    
    // Log activity
    await prisma.activity.create({
      data: {
        workspaceId,
        contactId,
        userId,
        type: 'contact_updated',
        description: 'Contact information updated',
      },
    });
    
    return updated;
  }
  
  async moveStage(contactId, newStage, workspaceId, userId) {
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: { stage: newStage },
    });
    
    await prisma.activity.create({
      data: {
        workspaceId,
        contactId,
        userId,
        type: 'stage_changed',
        description: `Stage changed to ${newStage}`,
      },
    });
    
    return contact;
  }
  
  async deleteContact(contactId, workspaceId, userId) {
    await prisma.contact.update({
      where: { id: contactId },
      data: { deletedAt: new Date() },
    });
    
    await prisma.activity.create({
      data: {
        workspaceId,
        contactId,
        userId,
        type: 'contact_deleted',
        description: 'Contact deleted',
      },
    });
    
    return { success: true };
  }
  
  async addLabels(contactId, labelIds, workspaceId, userId) {
    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        labels: {
          create: labelIds.map(labelId => ({
            labelId,
            assignedBy: userId,
          })),
        },
      },
      include: {
        labels: {
          include: {
            label: true,
          },
        },
      },
    });
    
    return contact;
  }
  
  async removeLabel(contactId, labelId) {
    await prisma.contactLabel.deleteMany({
      where: {
        contactId,
        labelId,
      },
    });
    
    return { success: true };
  }
  
  async addNote(contactId, note, workspaceId, userId) {
    const activity = await prisma.activity.create({
      data: {
        workspaceId,
        contactId,
        userId,
        type: 'note_added',
        description: note,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });
    
    return activity;
  }
  
  async detectDuplicates(workspaceId) {
    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
      },
    });
    
    const duplicates = [];
    const seen = new Map();
    
    for (const contact of contacts) {
      const key = `${contact.phone || ''}-${contact.email || ''}`;
      if (seen.has(key)) {
        duplicates.push({
          contacts: [seen.get(key), contact],
        });
      } else {
        seen.set(key, contact);
      }
    }
    
    return duplicates;
  }
  
  async mergeContacts(primaryId, secondaryIds, workspaceId) {
    const primary = await this.getContactById(primaryId, workspaceId);
    
    // Move all relationships to primary contact
    await Promise.all([
      prisma.message.updateMany({
        where: { contactId: { in: secondaryIds } },
        data: { contactId: primaryId },
      }),
      prisma.activity.updateMany({
        where: { contactId: { in: secondaryIds } },
        data: { contactId: primaryId },
      }),
      prisma.deal.updateMany({
        where: { contactId: { in: secondaryIds } },
        data: { contactId: primaryId },
      }),
    ]);
    
    // Delete secondary contacts
    await prisma.contact.deleteMany({
      where: { id: { in: secondaryIds } },
    });
    
    return primary;
  }
  
  async importCSV(csvData, workspaceId, userId) {
    // TODO: Implement CSV parsing and bulk import
    return { success: true, imported: 0, failed: 0 };
  }
  
  async exportCSV(workspaceId) {
    const contacts = await prisma.contact.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
    });
    
    // TODO: Generate CSV
    return contacts;
  }
}

export default new ContactService();
