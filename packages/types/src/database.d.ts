/// <reference path="../index.d.ts" />
import type { Document, Types } from 'mongoose';

// _id is a string for the frontend
// _id is a Mongoose ObjectId for backend Documents

declare global {
  /* AUDIT */

  interface Audit {
    _id: string;
    type: 'newTool' | 'updateTool';
    timestamp: string;
    old: any | null;
    new: any;
  }

  interface AuditDoc extends Omit<Audit, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* CUSTOMER */

  interface Customer {
    _id: string;
    name: string;
    logo?: string;
    homepage?: string;
  }

  interface CustomerDoc extends Omit<Customer, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* REPORT */

  interface Report {
    _id: string;
    email: string;
    tooling: Email;
  }

  interface Email {
    to: boolean;
    cc: boolean;
  }

  interface ReportDoc extends Omit<Report, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* MATERIAL */

  interface Material {
    _id: string;
    description: string;
    type: 'Round' | 'Flat';
    height: number | null;
    width: number | null;
    diameter: number | null;
    wallThickness: number | null;
    length: number | null;
    materialType: string;
    supplier?: Supplier | string;
  }

  interface MaterialDoc extends Omit<Material, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* PART */

  interface Part {
    _id: string;
    customer: Customer | string;
    part: string;
    description: string;
    stock: number;
    location?: string;
    position?: string;
    img?: string;
    revision?: string;
    material?: Material | string;
    materialLength: number;
    createdAt: Date;
  }

  interface PartDoc extends Omit<Part, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* TOOL */

  interface ToolDoc extends Omit<Tool, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* SUPPLIER */

  interface Supplier {
    _id: string;
    name: string;
    logo?: string;
    homepage?: string;
  }

  interface SupplierDoc extends Omit<Supplier, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }

  /* VENDOR */

  interface Vendor {
    _id: string;
    name: string;
    logo?: string;
    homepage?: string;
    coatings?: string[];
  }

  interface VendorDoc extends Omit<Vendor, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }
}
