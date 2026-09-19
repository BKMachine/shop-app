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

  interface PrintJobTravelerBody {
    jobNumber: number;
    barcodeText: string;
    partImageUrl?: string;
    jobDetails: PrintJobTravelerRow[];
    partDetails: PrintJobTravelerRow[];
    shipmentPlan?: PrintJobTravelerShipment[];
    operatorNotes?: string;
  }
}

export {};
