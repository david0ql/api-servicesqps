// Categorias de gasto alineadas con la Parte II del Schedule C (Form 1040) del IRS.
export const COST_CATEGORIES = [
  { value: 'advertising', label: 'Advertising', line: '8' },
  { value: 'car_truck', label: 'Car and Truck Expenses', line: '9' },
  { value: 'commissions_fees', label: 'Commissions and Fees', line: '10' },
  { value: 'contract_labor', label: 'Contract Labor', line: '11' },
  { value: 'insurance', label: 'Insurance', line: '15' },
  { value: 'interest_mortgage', label: 'Interest - Mortgage', line: '16a' },
  { value: 'interest_other', label: 'Interest - Other', line: '16b' },
  { value: 'legal_professional', label: 'Legal and Professional Services', line: '17' },
  { value: 'office_expense', label: 'Office Expense', line: '18' },
  { value: 'rent_vehicles', label: 'Rent or Lease - Vehicles, Machinery and Equipment', line: '20a' },
  { value: 'rent_property', label: 'Rent or Lease - Other Business Property', line: '20b' },
  { value: 'repairs_maintenance', label: 'Repairs and Maintenance', line: '21' },
  { value: 'supplies', label: 'Supplies', line: '22' },
  { value: 'travel', label: 'Travel and Meals - Travel', line: '24a' },
  { value: 'meals', label: 'Travel and Meals - Meals', line: '24b' },
  { value: 'other_expenses', label: 'Other Expenses', line: '27a' },
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number]['value'];

export const COST_CATEGORY_VALUES = COST_CATEGORIES.map(category => category.value);

export const DEFAULT_COST_CATEGORY: CostCategory = 'other_expenses';

export const CONTRACT_LABOR_CATEGORY: CostCategory = 'contract_labor';

export const CONTRACT_LABOR_DESCRIPTION = 'Full payment to a cleaner';
