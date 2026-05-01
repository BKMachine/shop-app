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
    mergedCount?: number;
    type:
      | 'tool'
      | 'material'
      | 'part'
      | 'image'
      | 'document'
      | 'customer'
      | 'supplier'
      | 'shipper'
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

  interface Email {
    to: boolean;
    cc: boolean;
  }

  interface EmailReportFields {
    email: string;
    tooling: Email;
  }

  interface EmailReport extends EmailReportFields {
    _id: string;
  }

  interface EmailReportCreate extends EmailReportFields {}

  interface EmailReportUpdate extends EmailReportFields {
    _id: string;
    __v?: number;
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

  /* SHIPPER */

  interface ShipperFields {
    name: string;
    logo?: string;
    homepage?: string;
  }

  interface Shipper extends ShipperFields {
    _id: string;
  }

  interface ShipperCreate extends ShipperFields {}

  interface ShipperUpdate extends ShipperFields {
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

  interface ImageFields {
    filename: string;
    relPath: string;
    mimeType?: string;
    status: 'temp' | 'attached';
    entityType:
      | 'tool'
      | 'part'
      | 'customer'
      | 'supplier'
      | 'shipper'
      | 'vendor'
      | 'shipment'
      | null;
    entityId: string | null;
    expiresAt?: Date | null;
  }

  /* SHIPMENT */

  interface ShipmentFields {
    shippedAt: string | Date;
    title?: string;
    customer?: string | Customer | null;
    shipper?: string | Shipper | null;
    orderNumber?: string;
    trackingNumber?: string;
    carrier?: string;
    notes?: string;
    imageIds?: string[];
  }

  interface Shipment extends ShipmentFields {
    _id: string;
    createdAt: string | Date;
    updatedAt: string | Date;
  }

  interface ShipmentCreate extends ShipmentFields {}

  interface ShipmentUpdate extends ShipmentFields {
    _id: string;
    __v?: number;
  }

  interface ShipmentListResponse {
    items: Shipment[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  }

  interface Image extends ImageFields {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
  }

  interface ImageCreate extends ImageFields {}

  interface ImageUpdate extends ImageFields {
    _id: string;
    createdAt?: Date;
    updatedAt?: Date;
    __v?: number;
  }

  /* STORED DOCUMENT */

  interface StoredDocumentFields {
    filename: string;
    originalName: string;
    relPath: string;
    mimeType?: string;
    extension?: string;
    size: number;
    entityType: 'part' | null;
    entityId: string | null;
  }

  interface StoredDocument extends StoredDocumentFields {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
  }

  interface StoredDocumentCreate extends StoredDocumentFields {}

  interface StoredDocumentUpdate extends StoredDocumentFields {
    _id: string;
    createdAt?: Date;
    updatedAt?: Date;
    __v?: number;
  }

  /* PART NOTE */

  interface PartNoteFields {
    partId: string;
    text: string;
    priority: 'critical' | 'default';
    createdByDeviceId: string;
    createdByDisplayName: string;
    updatedByDeviceId: string;
    updatedByDisplayName: string;
  }

  interface PartNote extends PartNoteFields {
    _id: string;
    createdAt: Date;
    updatedAt: Date;
  }

  interface PartNoteCreate {
    text: string;
    priority: 'critical' | 'default';
  }

  interface PartNoteUpdate extends PartNoteCreate {
    _id: string;
    __v?: number;
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
