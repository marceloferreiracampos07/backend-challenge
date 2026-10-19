import { z } from 'zod';

const plateAllowedCharacters = /^[A-Za-z0-9-]+$/;
const traditionalPlateRegex = /^[A-Z]{3}[0-9]{4}$/;
const mercosulPlateRegex = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;

export const plateSchema = z
  .string({ required_error: 'Placa é obrigatória' })
  .trim()
  .refine(value => plateAllowedCharacters.test(value), {
    message: 'Placa deve conter apenas letras, números e hífen',
  })
  .transform(value => value.replace(/-/g, '').toUpperCase())
  .refine(value => traditionalPlateRegex.test(value) || mercosulPlateRegex.test(value), {
    message: 'Placa deve seguir o formato tradicional (ABC1234) ou Mercosul (ABC1D23)',
  });
