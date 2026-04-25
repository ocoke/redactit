export type Box = { x: number; y: number; w: number; h: number };

export type OcrWord = {
  text: string;
  confidence: number;
  box: Box;
};

export type OcrLine = {
  text: string;
  box: Box;
  words: OcrWord[];
};

export type ScreenType =
  | 'chat'
  | 'email'
  | 'form'
  | 'social'
  | 'code'
  | 'document'
  | 'unknown';

export type RoleLabel =
  | 'chat_header_contact'
  | 'email_sender'
  | 'email_recipient'
  | 'form_value'
  | 'username'
  | 'secret_candidate'
  | 'timestamp'
  | 'message_body'
  | 'generic';

export type RoleAssignment = {
  wordIndex: number;
  role: RoleLabel;
};

export type DetectionType =
  | 'private_person'
  | 'email'
  | 'phone'
  | 'url'
  | 'account_number'
  | 'secret'
  | 'username'
  | 'private_date'
  | 'generic_sensitive';

export type Detection = {
  id: string;
  sourceText: string;
  type: DetectionType;
  reason: string;
  score: number;
  wordIndices: number[];
  active: boolean;
};

export type Mode = 'strict' | 'balanced';
