"use client";

import { Church } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from "@/lib/axios";
import { toast } from "sonner";

type ChurchOption = {
  id: string;
  name: string;
  country: string;
  state: string;
};

export default function ChooseChurchPage() {
  const router = useRouter();
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api
      .get("/churches")
      .then((res) => setChurches(res.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get("/churches/my").then((res) => {
      if (res.data.data?.id) router.push("/dashboard");
    });
  }, []);

  const groupedChurches = churches.reduce<Record<string, ChurchOption[]>>(
    (acc, church) => {
      const key = church.state || church.country;
      if (!acc[key]) acc[key] = [];
      acc[key].push(church);
      return acc;
    },
    {}
  );

  async function handleSubmit() {
    if (!selectedId) {
      toast.warning("Please select a church");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/churches/choose", { churchId: selectedId });
      toast.success("Church selected! Awaiting approval.");
      router.push("/dashboard");
    } catch {
      toast.error("Could not select church");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4 sm:px-6">
      <div className="w-full max-w-lg p-6 flex flex-col gap-6 rounded-lg border shadow-md">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Church className="size-7" />
          </div>
          <h1 className="font-bold text-2xl">Choose your church</h1>
          <p className="text-muted-foreground">
            Select the church you belong to. You&apos;ll need to be approved by
            a church leader before you can access the full site.
          </p>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground">
            Loading churches...
          </p>
        ) : churches.length === 0 ? (
          <p className="text-center text-muted-foreground">
            No churches available. Please contact support.
          </p>
        ) : (
          <>
            <Select onValueChange={setSelectedId} value={selectedId}>
              <SelectTrigger className="w-full py-5">
                <SelectValue placeholder="Select a church" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedChurches).map(([region, list]) => (
                  <SelectGroup key={region}>
                    <SelectLabel>{region}</SelectLabel>
                    {list.map((church) => (
                      <SelectItem key={church.id} value={church.id}>
                        {church.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleSubmit}
              disabled={!selectedId || submitting}
              className="w-full justify-center"
            >
              {submitting ? "Submitting..." : "Join Church"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
