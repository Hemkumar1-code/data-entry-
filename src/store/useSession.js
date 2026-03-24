import { useContext } from 'react';
import { SessionContext } from './sessionCtx';

export const useSession = () => useContext(SessionContext);
