/// <reference path="../index.d.ts" />
import { Types, Document } from 'mongoose';

// _id is a string for frontend
// _id is a Mongoose ObjectId for backend

declare global {
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
    supplier?: SupplierDoc | string;
    __v: number;
  }

  interface MaterialDoc extends Omit<Material, '_id'>, Document<Types.ObjectId> {
    _id: Types.ObjectId;
  }
}
