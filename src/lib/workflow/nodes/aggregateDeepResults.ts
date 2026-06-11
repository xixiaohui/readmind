// Node: aggregateDeepResults — combine all Phase 2 deep analyses
import type { BookAnalysisStateType } from "../state";
import type { DeepAnalysisSet } from "@/lib/types";

export async function aggregateDeepResults(state: BookAnalysisStateType) {
  const deep: DeepAnalysisSet = {};

  if (state.characterAnalysis) deep.character = state.characterAnalysis;
  if (state.psychologyAnalysis) deep.psychology = state.psychologyAnalysis;
  if (state.sociologyAnalysis) deep.sociology = state.sociologyAnalysis;
  if (state.politicalEconomyAnalysis) deep.politicalEconomy = state.politicalEconomyAnalysis;
  if (state.literaryCriticAnalysis) deep.literaryCritic = state.literaryCriticAnalysis;
  if (state.religiousAnalysis) deep.religious = state.religiousAnalysis;

  console.log(`[aggregateDeepResults] Combined ${Object.keys(deep).length}/6 deep analyses`);

  return { deepAggregated: deep, currentNode: "aggregateDeepResults" };
}
