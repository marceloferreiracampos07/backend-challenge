import { z } from 'zod';

const platePattern = /^[A-Za-z0-9-]+$/;

export const plateSchema = z
  .string({ required_error: 'Placa é obrigatória' })
  .trim()
  .refine(value => platePattern.test(value), {
    message: 'Placa deve conter apenas letras, números e hífen',
  })
  // Remove o hífen e converte para maiúsculo para caber no limite da coluna do banco
  .transform(value => value.replace(/-/g, '').toUpperCase())
  .refine(value => value.length >= 3 && value.length <= 7, {
    message: 'Placa deve ter entre 3 e 7 caracteres (sem contar hífen)',
  });
