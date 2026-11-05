export const PDF_MACHINE_TYPES = [
  'SNLS',
  'OVERLOCK',
  'FLATLOCK',
  'S/N EDGE CUTTER',
  'SMALL FUSHING',
  'BIG FUSHING',
  'MEDIUM FUSHING',
  'MINI TEMPLATE',
  'PIC',
  'BUTTON',
  'BUTTON HOLE',
  'BUTTON ATTACH',
  'BUTTON(AUTOMATIC)',
  'BARTACK',
  'KAJA',
  'MULTI NEEDLE',
  'DOUBLE NEEDLE',
  'PATTERN TAKER',
  'TEMPLATE M/C',
] as const;

export type PdfMachineType = (typeof PDF_MACHINE_TYPES)[number];

// Actual Machine Makes directly from both Plant Sheets (PDF 1 & PDF 2)
export const PDF_MACHINE_MAKES = [
  'JUKI',
  'JACK',
  'BROTHER',
  'PEGASUS',
  'YAMATO',
  'PGS',
  'SUPREME',
  'KANSAI',
  'BHARATH',
  'HI-TECH',
] as const;

