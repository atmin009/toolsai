import { createContext, useContext, type ReactNode } from "react";
import { th } from "./th";

function translate(key: string): string {
  return th[key] ?? key;
}

type TFunction = (key: string) => string;
const I18nContext = createContext<TFunction>(translate);

export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nContext.Provider value={translate}>{children}</I18nContext.Provider>;
}

export function useI18n(): TFunction {
  return useContext(I18nContext);
}
