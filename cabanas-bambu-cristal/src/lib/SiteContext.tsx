import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { subscribeCalendar, subscribeContent, withDefaults } from "./store";
import type { Calendar, SiteContent } from "./types";

interface SiteState {
  content: SiteContent;
  calendar: Calendar;
  ready: boolean;
}

const Ctx = createContext<SiteState>({ content: withDefaults(null), calendar: {}, ready: false });

export function SiteProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(() => withDefaults(null));
  const [calendar, setCalendar] = useState<Calendar>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const a = subscribeContent((c) => {
      setContent(c);
      setReady(true);
    });
    const b = subscribeCalendar(setCalendar);
    return () => {
      a();
      b();
    };
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", content.general.accentColor || "#8a7a4f");
    document.title = content.general.name;
  }, [content.general.accentColor, content.general.name]);

  return <Ctx.Provider value={{ content, calendar, ready }}>{children}</Ctx.Provider>;
}

export const useSite = () => useContext(Ctx);
