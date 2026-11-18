declare global {
  interface PrintLocationBody {
    loc: string;
    pos: string;
  }

  interface PrintItemBody {
    description: string;
    identifier: string;
    entity: string;
    loc: string;
    pos: string;
    qrText: string;
    imageUrl?: string;
    labelOffsetX?: number;
    labelOffsetY?: number;
  }

  interface PrintJobTravelerRow {
    label: string;
    value: string;
  }

  interface PrintJobTravelerShipment {
    shipDate: string;
    qty: string;
    po?: string;
  }

  interface PrintJobTravelerRoutingOp {
    /** Display op number, e.g. "OP10". */
    op: string;
    operation: string;
    department: string;
  }

  interface PrintJobTravelerBody {
    jobNumber: number;
    barcodeText: string;
    partImageUrl?: string;
    jobDetails: PrintJobTravelerRow[];
    partDetails: PrintJobTravelerRow[];
    shipmentPlan?: PrintJobTravelerShipment[];
    routing?: PrintJobTravelerRoutingOp[];
    operatorNotes?: string;
  }
}

export {};
