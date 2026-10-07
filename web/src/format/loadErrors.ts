import type { LoadError } from '../io/parse'
import type { Expected, LoadProblem, Place } from '../io/validate'

/** At most this many problems are listed; the rest are counted. */
export const MAX_LISTED_PROBLEMS = 5

const KIND_LABELS: Record<Exclude<Place['kind'], 'workspace'>, string> = {
  terms: 'Terms',
  amountSet: 'Amount set',
  scenario: 'Scenario',
  tag: 'Tag',
  sweep: 'Saved sweep',
  filterView: 'Filter view',
}

const EXPECTED: Record<Expected, string> = {
  text: 'text',
  number: 'a number',
  boolean: 'true or false',
  list: 'a list',
  object: 'an object',
}

const MISSING_REF = {
  terms: "refers to terms that aren't in the file",
  amountSet: "refers to an amount set that isn't in the file",
  tag: "refers to a tag that isn't in the file",
} as const

/** E.g. `Scenario "Base · Q3"`, or `Scenario 4` when it has no name. */
function placeLabel(place: Place): string {
  if (place.kind === 'workspace') return 'The workspace'
  const kind = KIND_LABELS[place.kind]
  return place.name === undefined ? `${kind} ${place.index + 1}` : `${kind} "${place.name}"`
}

/** E.g. `gain › tiers 2 › sharePct`. List positions count from 1. */
function fieldLabel(field: LoadProblem['field']): string {
  const parts: string[] = []
  for (const f of field) {
    if (typeof f === 'number' && parts.length > 0) parts[parts.length - 1] += ` ${f + 1}`
    else parts.push(String(f))
  }
  return parts.join(' › ')
}

function what(p: LoadProblem): string {
  switch (p.code) {
    case 'missing':
      return 'is missing'
    case 'wrongType':
      return `should be ${EXPECTED[p.expected]}`
    case 'unknownValue':
      return `has an unknown value "${p.value}" (expected ${p.allowed.map((a) => `"${a}"`).join(', ')})`
    case 'emptyId':
      return 'is empty'
    case 'duplicateId':
      return `"${p.id}" is used more than once`
    case 'duplicateTagName':
      return `"${p.name}" is used by another tag (names ignore case)`
    case 'duplicateTagRef':
      return `lists tag "${p.id}" more than once`
    case 'badPrecision':
      return 'should be a whole number of 0 or more'
    case 'badCurrency':
      return `"${p.value}" isn't a currency code such as USD`
    case 'badLocale':
      return `"${p.value}" isn't a language tag such as en-US`
    case 'badTimestamp':
      return `"${p.value}" isn't a date and time such as 2026-01-31T09:00:00Z`
    case 'missingRef':
      return `${MISSING_REF[p.target]} ("${p.id}")`
  }
}

/** E.g. `Scenario "Base · Q3", termsId: refers to terms that aren't in the file ("t9").` */
export function problemMessage(p: LoadProblem): string {
  const field = fieldLabel(p.field)
  return `${placeLabel(p.place)}${field && `, ${field}`}: ${what(p)}.`
}

/** A heading and detail lines explaining why a workspace couldn't be opened (§11.2). */
export function loadErrorMessage(error: LoadError): { title: string; details: string[] } {
  switch (error.kind) {
    case 'notJson':
      return { title: "This file isn't a Risk Share workspace.", details: ["It isn't valid JSON."] }
    case 'notAWorkspace':
      return { title: "This file isn't a Risk Share workspace.", details: ["It doesn't have a workspace format version this app recognizes."] }
    case 'newerVersion':
      return {
        title: 'This workspace was saved by a newer version of Risk Share.',
        details: [
          error.appVersion
            ? `It needs Risk Share ${error.appVersion} or later; this is ${__APP_VERSION__}. Reload the page to get the latest version.`
            : `This is Risk Share ${__APP_VERSION__}. Reload the page to get the latest version.`,
        ],
      }
    case 'migrationFailed':
      return {
        title: "This workspace couldn't be updated to the current format.",
        details: [`It's in an older format (version ${error.schemaVersion}), and part of it couldn't be converted.`],
      }
    case 'invalid': {
      const listed = error.problems.slice(0, MAX_LISTED_PROBLEMS).map(problemMessage)
      const more = error.problems.length - listed.length
      return {
        title: "This workspace file has problems, so it can't be opened.",
        details: more > 0 ? [...listed, `…and ${more} more.`] : listed,
      }
    }
  }
}
