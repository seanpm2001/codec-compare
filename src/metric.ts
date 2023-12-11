// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {areFieldsComparable, Batch, Field, FieldId} from './entry';
import {GeometricMean} from './geometric_mean';
import {Match} from './matcher';

/** References two fields from two selected batches to compare data points. */
export class FieldMetric {
  enabled = false;

  /**
   * @param fieldIndices As many indices as State.batches and in the same order.
   *                     Each index is used for Batch.fields[].
   */
  constructor(public fieldIndices: number[]) {}
}

/** Aggregated stats for a FieldMetric. */
export class FieldMetricStats {
  geometricMean = 1;
  minRatio = 1;
  maxRatio = 1;
  arithmeticMean = 1;

  getMean(geometric: boolean) {
    return geometric ? this.geometricMean : this.arithmeticMean;
  }
}

/** Returns all possible metrics given two batches. */
export function createMetrics(batches: Batch[]): FieldMetric[] {
  const metrics: FieldMetric[] = [];
  if (batches.length === 0) {
    return metrics;
  }

  for (const [fieldIndex, field] of batches[0].fields.entries()) {
    const fieldIndices: number[] = [];
    fieldIndices.push(fieldIndex);
    let isNumber = field.isNumber;
    for (let i = 1; i < batches.length; ++i) {
      const otherBatch = batches[i];
      const otherFieldIndex =
          otherBatch.fields.findIndex((otherField: Field) => {
            return areFieldsComparable(field, otherField);
          });
      if (otherFieldIndex === -1) {
        break;
      }
      fieldIndices.push(otherFieldIndex);
      const otherField = otherBatch.fields[otherFieldIndex];
      isNumber = isNumber && otherField.isNumber;
    }

    // At least one batch is missing that field.
    if (fieldIndices.length !== batches.length) continue;
    // Metrics can only be computed on numbers.
    if (!isNumber) continue;
    // Same source image, so same source image features. No need to compare.
    if (field.id === FieldId.WIDTH || field.id === FieldId.HEIGHT) continue;
    // Encoder settings should not be compared.
    if (field.id === FieldId.EFFORT || field.id === FieldId.QUALITY) continue;

    metrics.push(new FieldMetric(fieldIndices));
  }
  return metrics;
}

/** Arbitrarily enable some metric (focusing on lossy image comparison). */
export function enableDefaultMetrics(
    firstBatch: Batch, metrics: FieldMetric[]) {
  for (const metric of metrics) {
    const field = firstBatch.fields[metric.fieldIndices[0]];
    if (field.id === FieldId.ENCODED_SIZE ||
        field.id === FieldId.ENCODING_DURATION ||
        field.id === FieldId.DECODING_DURATION) {
      metric.enabled = true;
    }
  }
}

/** Selects two metrics no matter what. Prefers enabled metrics. */
export function selectPlotMetrics(firstBatch: Batch, metrics: FieldMetric[]):
    [FieldMetric|undefined, FieldMetric|undefined] {
  let xMetric: FieldMetric|undefined = undefined;
  let yMetric: FieldMetric|undefined = undefined;

  const metricToFieldId = (metric: FieldMetric) => {
    return firstBatch.fields[metric.fieldIndices[0]].id;
  };

  // Try ENCODED_SIZE as x and ENCODING_DURATION as y (or DECODING_DURATION as
  // y otherwise) if they are enabled.
  xMetric = metrics.find(
      m => m.enabled && metricToFieldId(m) === FieldId.ENCODED_SIZE);
  yMetric = metrics.find(
      m => m.enabled && metricToFieldId(m) === FieldId.ENCODING_DURATION);
  if (yMetric === undefined) {
    yMetric = metrics.find(
        m => m.enabled && metricToFieldId(m) === FieldId.DECODING_DURATION);
  }
  if (xMetric !== undefined && yMetric !== undefined) {
    return [xMetric, yMetric];
  }

  // Try the first two enabled metrics.
  xMetric = metrics.find(m => m.enabled);
  yMetric = metrics.find(m => m.enabled && m !== xMetric);
  if (xMetric !== undefined) {
    return [xMetric, yMetric ?? xMetric];
  }
  xMetric = yMetric = undefined;

  // Fallback to whatever.
  return metrics.length > 0 ? [metrics[0], metrics[0]] : [undefined, undefined];
}

/** Returns a/b with some arbitrary real definition if both a and b are 0. */
export function getRatio(a: number, b: number) {
  return b === 0 ? (a === 0 ? 1 : Infinity) : a / b;
}

/**
 * Returns FieldMetricStats for each of the metrics, computed on the matched
 * filtered dataPoints from the leftBatch and rightBatch.
 */
export function computeStats(
    leftBatch: Batch, rightBatch: Batch, dataPoints: Match[],
    metrics: FieldMetric[]): FieldMetricStats[] {
  const stats: FieldMetricStats[] = [];
  for (const metric of metrics) {
    const leftFieldIndex = metric.fieldIndices[leftBatch.index];
    const rightFieldIndex = metric.fieldIndices[rightBatch.index];

    const fieldStats = new FieldMetricStats();
    let numDataPoints = 0;
    const geometricMean = new GeometricMean();
    let leftSum = 0;
    let rightSum = 0;
    for (const dataPoint of dataPoints) {
      const leftValue =
          leftBatch.rows[dataPoint.leftIndex][leftFieldIndex] as number;
      const rightValue =
          rightBatch.rows[dataPoint.rightIndex][rightFieldIndex] as number;
      const ratio = getRatio(leftValue, rightValue);
      // Note: A ratio of 0 would set the entire geometric mean to 0, but
      //       it is safer to surface that in the final user interface than
      //       silently skipping that data point here.

      if (numDataPoints === 0) {
        fieldStats.minRatio = ratio;
        fieldStats.maxRatio = ratio;
      } else {
        fieldStats.minRatio = Math.min(fieldStats.minRatio, ratio);
        fieldStats.maxRatio = Math.max(fieldStats.maxRatio, ratio);
      }
      geometricMean.add(ratio);
      leftSum += leftValue;
      rightSum += rightValue;
      ++numDataPoints;
    }
    if (numDataPoints > 0) {
      fieldStats.geometricMean = geometricMean.get();
      fieldStats.arithmeticMean = getRatio(leftSum, rightSum);
    }
    stats.push(fieldStats);
  }
  return stats;
}
