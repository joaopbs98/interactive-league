"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

export function CalendarPop() {
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          {date?.toLocaleDateString() ?? "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            setDate(d);
            setOpen(false);
          }}
          className="rounded-md border shadow-sm"
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  );
}
