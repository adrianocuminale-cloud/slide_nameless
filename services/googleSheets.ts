
import { MeetingRecord, Speaker } from '../types';

const SHEET_ID = '11Fhl7NrWdz3IFEmXdzRcbSLRI26VtT2rPl64o3a0urY';
const SHEET_NAME_REUNIONI = 'elenco riunioni';
const SHEET_NAME_FOGLIO1 = 'Foglio1';
const SHEET_NAME_NOMI = 'elenco nomi';

const getCsvUrl = (sheetName: string) => 
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

export const fetchSheetRecords = async (sheetName: string): Promise<MeetingRecord[]> => {
  try {
    const response = await fetch(getCsvUrl(sheetName));
    const csvText = await response.text();
    
    const lines = csvText.split('\n').map(line => {
      // Gestione CSV avanzata per celle contenenti virgole racchiuse tra virgolette
      const matches = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=^)(?=,))/g);
      return matches ? matches.map(cell => cell.replace(/^"(.*)"$/, '$1')) : [];
    });
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].map(h => h.toLowerCase().trim());
    
    const dateIdx = headers.findIndex(h => h.includes('data'));
    const memberIdx = headers.findIndex(h => h.includes('membro') || h.includes('nome'));
    const contactsIdx = headers.findIndex(h => h.includes('contatti') || h.includes('strategici'));
    const thanksIdx = headers.findIndex(h => h.includes('grazie'));
    const affareFattoIdx = headers.findIndex(h => h.includes('affare fatto'));
    
    // Ricerca flessibile per la colonna target
    const targetIdx = headers.findIndex(h => 
      h.includes('target') || 
      h.includes('destinatario') || 
      h.includes('referenza') || 
      h.includes('contatto')
    );

    return lines.slice(1).map(row => ({
      data: row[dateIdx]?.trim() || '',
      membro: row[memberIdx]?.trim() || 'Sconosciuto',
      contattiStrategici: parseInt(row[contactsIdx]) || 0,
      grazieGenerati: parseFloat(row[thanksIdx]?.replace(',', '.')) || 0,
      affareFatto: affareFattoIdx !== -1 ? (parseFloat(row[affareFattoIdx]?.replace(',', '.')) || 0) : 0,
      target: targetIdx !== -1 ? row[targetIdx]?.trim() : undefined
    })).filter(r => r.data !== '');
  } catch (error) {
    console.error(`Error fetching data from sheet ${sheetName}:`, error);
    return [];
  }
};

export const fetchSpreadsheetData = () => fetchSheetRecords(SHEET_NAME_REUNIONI);
export const fetchFoglio1Data = () => fetchSheetRecords(SHEET_NAME_FOGLIO1);

export const fetchSpeakers = async (): Promise<Speaker[]> => {
  try {
    const response = await fetch(getCsvUrl(SHEET_NAME_NOMI));
    const csvText = await response.text();
    
    const lines = csvText.split('\n').map(line => {
      const matches = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=^)(?=,))/g);
      return matches ? matches.map(cell => cell.replace(/^"(.*)"$/, '$1')) : [];
    });
    
    if (lines.length === 0) return [];
    
    const headers = lines[0].map(h => h.toLowerCase().trim());
    
    const nomeIdx = headers.findIndex(h => h.includes('nome'));
    const professioneIdx = headers.findIndex(h => h.includes('professione'));
    const descrizioneIdx = headers.findIndex(h => 
      h.includes('breve descrizione') || 
      h.includes('descrizione')
    );

    if (nomeIdx === -1) return [];

    const speakers = lines.slice(1)
      .map(row => ({
        nome: row[nomeIdx]?.trim() || '',
        professione: professioneIdx !== -1 ? row[professioneIdx]?.trim() : undefined,
        descrizione: descrizioneIdx !== -1 ? row[descrizioneIdx]?.trim() : undefined,
      }))
      .filter(s => s.nome.length > 0);

    return speakers.sort((a, b) => a.nome.localeCompare(b.nome));
  } catch (error) {
    console.error('Error fetching speakers:', error);
    return [];
  }
};
