
import React, { useState } from 'react';
import { NewRecordInput } from '../types';

interface DataInputFormProps {
  onSubmit: (data: NewRecordInput) => void;
}

const DataInputForm: React.FC<DataInputFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<NewRecordInput>({
    membro: '',
    contatti: '',
    grazie: '',
    data: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.membro || !formData.contatti || !formData.grazie) return;
    onSubmit(formData);
    setFormData({ membro: '', contatti: '', grazie: '', data: new Date().toISOString().split('T')[0] });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
      <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
        </svg>
        Inserimento Nuovo Scambio
      </h2>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Membro</label>
          <input
            type="text"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            placeholder="Nome Cognome"
            value={formData.membro}
            onChange={(e) => setFormData({ ...formData, membro: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Contatti Strategici</label>
          <input
            type="number"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            placeholder="Es. 3"
            value={formData.contatti}
            onChange={(e) => setFormData({ ...formData, contatti: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Grazie Generati (€)</label>
          <input
            type="number"
            step="0.01"
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
            placeholder="Es. 1500.00"
            value={formData.grazie}
            onChange={(e) => setFormData({ ...formData, grazie: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-all active:scale-95"
          >
            Aggiungi Record
          </button>
        </div>
      </form>
    </div>
  );
};

export default DataInputForm;
