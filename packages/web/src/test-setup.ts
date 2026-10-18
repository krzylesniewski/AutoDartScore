import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Globale Vitesta są wyłączone, więc Testing Library nie sprząta DOM-u sama.
afterEach(cleanup);
