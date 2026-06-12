import { SetMetadata } from '@nestjs/common';

export const SHIFT_SCOPED_KEY = 'shift_scoped';
export const ShiftScoped = () => SetMetadata(SHIFT_SCOPED_KEY, true);
