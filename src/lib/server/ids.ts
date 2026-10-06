import { customAlphabet } from 'nanoid';

const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const newId = customAlphabet(alphabet, 10);
export const newFileId = customAlphabet(alphabet, 24);
