import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type TimelineEntry = {
  date: string;
  title: string;
  content: string;
};

const timelineData: TimelineEntry[] = [
  {
    date: "1956",
    title: "The Birth of AI",
    content: "Inter Miami opened a S6 Prime Pack",
  },
  {
    date: "1966-1973",
    title: "Early Optimism and First AI Winter",
    content: "Trade offer accepted: Mbappé for 221M$ to Atlanta United",
  },
  {
    date: "1997",
    title: "Deep Blue Defeats Chess Champion",
    content: "Trade offer accepted: Coutinho for 24M$ to Manchester United",
  },
  {
    date: "1997",
    title: "Deep Blue Defeats Chess Champion",
    content: "Trade offer accepted: João Félix for 15M$ to Inter Miami",
  },
];

const Timeline9 = () => {
  return (
    <section className="bg-background">
      <div className="">
        <p className="font-bold">Dynamic Feed</p>
        <div className="relative mx-auto max-w-4xl">
          <Separator
            orientation="vertical"
            className="bg-muted absolute left-2 top-4"
          />
          {timelineData.map((entry, index) => (
            <div key={index} className="relative mb-10 pl-8">
              <div className="bg-foreground absolute left-0 top-3.5 flex size-4 items-center justify-center rounded-full" />

              <h5 className="text-sm self-center -left-34 text-muted-foreground top-3 rounded-xl tracking-tight xl:absolute">
                {entry.date}
              </h5>

              <Card className="my-5 border-none shadow-none">
                <CardContent className="px-0 xl:px-2">
                  <div
                    className="prose dark:prose-invert text-foreground"
                    dangerouslySetInnerHTML={{ __html: entry.content }}
                  />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export { Timeline9 };
