"use client";

import { useEffect, useMemo, useState } from "react";

import api from "@/lib/axios";
import {
  leaderRoleOptions,
  type LeaderRoleInfo,
} from "@/lib/leaderRoles";

let cachedInfo: LeaderRoleInfo | null = null;
let inFlight: Promise<LeaderRoleInfo | null> | null = null;

function fetchLeaderRoles(): Promise<LeaderRoleInfo | null> {
  if (inFlight) return inFlight;

  inFlight = api
    .get("/leader-roles")
    .then((res) => (res.data?.data ?? null) as LeaderRoleInfo | null)
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Update the shared cache after the admin role page mutates roles. */
export function setLeaderRolesCache(info: LeaderRoleInfo | null) {
  cachedInfo = info;
}

/**
 * Loads the admin-managed leader roles once per client session. Components that
 * render frequently (for example one role dropdown per participant) share the
 * same cached list instead of firing a request each.
 */
export function useLeaderRoles() {
  const [roleInfo, setRoleInfo] = useState<LeaderRoleInfo | null>(cachedInfo);

  useEffect(() => {
    let active = true;

    if (cachedInfo) {
      return;
    }

    fetchLeaderRoles().then((info) => {
      if (!active) return;
      if (info) cachedInfo = info;
      setRoleInfo(info);
    });

    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(() => leaderRoleOptions(roleInfo), [roleInfo]);

  return {
    roleInfo,
    primaryRoles: options.primary,
    secondaryRoles: options.secondary,
  };
}
