// Material types are in materials.d.ts
// Part types are in parts.d.ts
// Tool types are in tooling.d.ts

import type { Document, Types } from 'mongoose';

// _id is a string for the frontend
// _id is a Mongoose ObjectId for backend Documents

declare global {
  /* AUDIT */

  interface Audit {
    _id: string;
    type:
      | 'tool'
      | 'material'
      | 'part'
      | 'image'
      | 'document'
      | 'customer'
      | 'supplier'
      | 'vendor'
      | 'report'
      | 'part_note';
    timestamp: string;
    device: Device;
    old: any | null;
    new: any | null;
  }

  interface AuditDoc extends Omit<Audit, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* CUSTOMER */

  interface CustomerFields {
    name: string;
    logo?: string;
    homepage?: string;
  }

  interface Customer extends CustomerFields {
    _id: string;
  }

  interface CustomerCreate extends CustomerFields {}

  interface CustomerUpdate extends CustomerFields {
    _id: string;
    __v?: number;
  }

  /* REPORT */

  interface EmailReport {
    _id: string;
    email: string;
    tooling: Email;
  }

  interface Email {
    to: boolean;
    cc: boolean;
  }

  interface EmailReportDoc extends Omit<EmailReport, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* SUPPLIER */

  interface SupplierFields {
    name: string;
    logo?: string;
    homepage?: string;
  }

  interface Supplier extends SupplierFields {
    _id: string;
  }

  interface SupplierCreate extends SupplierFields {}

  interface SupplierUpdate extends SupplierFields {
    _id: string;
    __v?: number;
  }

  /* VENDOR */

  interface VendorFields {
    name: string;
    logo?: string;
    homepage?: string;
    coatings?: string[];
  }

  interface Vendor extends VendorFields {
    _id: string;
  }

  interface VendorCreate extends VendorFields {}

  interface VendorUpdate extends VendorFields {
    _id: string;
    __v?: number;
  }

  /* IMAGE */

  interface Image {
    _id: string;
    filename: string;
    relPath: string;
    mimeType?: string;
    status: 'temp' | 'attached';
    entityType: 'tool' | 'part' | 'customer' | 'supplier' | 'vendor' | null;
    entityId: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface ImageDoc extends Omit<Image, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* STORED DOCUMENT */

  interface StoredDocument {
    _id: string;
    filename: string;
    originalName: string;
    relPath: string;
    mimeType?: string;
    extension?: string;
    size: number;
    entityType: 'part' | null;
    entityId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface StoredDocumentDoc extends Omit<StoredDocument, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* PART NOTE */

  interface PartNote {
    _id: string;
    partId: Part | string;
    text: string;
    priority: 'critical' | 'default';
    createdAt: Date;
    updatedAt: Date;
    createdByDeviceId: string;
    createdByDisplayName: string;
    updatedByDeviceId: string;
    updatedByDisplayName: string;
  }

  interface PartNoteDoc extends Omit<PartNote, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* DEVICE */

  interface DeviceFields {
    deviceId: string;
    displayName: string;
    deviceType: 'pc' | 'android' | 'unknown';
    isAdmin: boolean;
    approved: boolean;
    blocked: boolean;
    firstSeenAt: Date;
    lastSeenAt: Date;
    lastIp: string | null;
    lastUserAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
  }

  interface Device extends DeviceFields {
    _id: string;
  }

  interface DeviceCreate extends DeviceFields {}

  interface DeviceUpdate extends DeviceFields {
    _id: string;
    __v?: number;
  }
}
