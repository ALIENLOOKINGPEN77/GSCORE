// app/lib/firebase/db.ts


"use client";

import "./client"; // side-effect: initializes the app once
import { getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

export const db = getFirestore(getApp());
