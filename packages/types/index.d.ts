/// <reference path="./src/api.d.ts" />
/// <reference path="./src/elastic.d.ts" />
/// <reference path="./src/express.d.ts" />
/// <reference path="./src/machine.d.ts" />
/// <reference path="./src/materials.d.ts" />
/// <reference path="./src/mtconnect.d.ts" />
/// <reference path="./src/parts.d.ts" />
/// <reference path="./src/pdf_parser.d.ts" />
/// <reference path="./src/remote_serial_port.d.ts" />
/// <reference path="./src/socket.io.d.ts" />
/// <reference path="./src/tooling.d.ts" />

declare global {
  type Rule = (value: string) => boolean | string;
  type Rules<Key extends string = string> = Record<Key, Rule>;

  interface PrintLocationBody {
    loc: string;
    pos: string;
  }

  interface PrintItemBody {
    item: string;
    description: string;
    brand: string;
  }

  interface PrintPartPositionBody {
    partId: string;
    part: string;
    description: string;
    loc: string;
    pos: string;
    partImageUrl?: string;
  }

  interface PrintRequest {
    printerName: string;
    labelXml: string;
  }

  interface RecentImage {
    id: string;
    url: string;
    createdAt: string;
  }

  interface MyImageData {
    id: string;
    url: string;
    createdAt: string;
    isMain?: boolean;
  }

  interface MyDocumentData {
    id: string;
    filename: string;
    originalName: string;
    url: string;
    mimeType?: string;
    extension?: string;
    size: number;
    createdAt: string;
  }

  interface MyPartNoteData {
    id: string;
    text: string;
    priority: 'critical' | 'default';
    createdAt: string;
    updatedAt: string;
    createdByDeviceId: string;
    createdByDisplayName: string;
    updatedByDeviceId: string;
    updatedByDisplayName: string;
  }
}

export {};
