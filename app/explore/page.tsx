"use client";
import { CustomerShell } from "@/components/customer/shell";
import { Welcome } from "@/components/landing/welcome";

/** The full plans-and-bundles landing, reachable from the start screen for owners who want to look before signing up. */
export default function Explore() { return <CustomerShell><Welcome /></CustomerShell>; }
