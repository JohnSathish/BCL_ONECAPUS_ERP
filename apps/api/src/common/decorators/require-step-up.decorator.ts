import { SetMetadata } from '@nestjs/common';

export const REQUIRE_STEP_UP_KEY = 'requireStepUp';

/** Destructive or sensitive actions require recent step-up authentication. */
export const RequireStepUp = () => SetMetadata(REQUIRE_STEP_UP_KEY, true);
