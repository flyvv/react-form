import React, { createContext, useContext } from 'react';
import { FormModel } from '../model';

const ModelContext = createContext<FormModel<any>>(null);

export function useModel<T = any>() {
  return useContext(ModelContext) as FormModel<T>;
}

ModelContext.displayName = 'ModelContext';
export const ModelProvider = ModelContext.Provider;
