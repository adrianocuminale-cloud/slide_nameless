
export interface MeetingRecord {
  data: string;
  membro: string;
  contattiStrategici: number;
  grazieGenerati: number;
  affareFatto: number;
  target?: string;
}

export interface DashboardStats {
  contattiSettimana: number;
  contattiTotali: number;
  grazieSettimana: number;
  grazieTotali: number;
}

export interface NewRecordInput {
  membro: string;
  contatti: string;
  grazie: string;
  data: string;
}

export interface Speaker {
  nome: string;
  professione?: string;
  descrizione?: string;
}
