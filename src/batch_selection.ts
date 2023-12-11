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

import {Batch} from './entry';
import {dispatch, EventType, listen} from './events';
import {enableDefaultFilters, FieldFilter, getFilteredRowIndices} from './filter';
import {MatchedDataPoints} from './matcher';
import {FieldMetricStats} from './metric';

/** One Batch (~ codec experiment results) to compare with another. */
export class BatchSelection {
  /** The selected set of input raw data points. */
  batch: Batch;

  /**
   * How to filter these input raw data points into a subset that will be used
   * for the comparison.
   */
  fieldFilters: FieldFilter[] = [];  // As many as batch.fields.

  /** The indices of the rows. Each index refers to batch.rows[]. */
  filteredRowIndices: number[] = [];  // At most batch.rows.length.

  /** The data points matched against State.referenceBatchSelectionIndex. */
  matchedDataPoints = new MatchedDataPoints();

  /** The statistics to display. */
  stats: FieldMetricStats[] = [];  // As many as State.metrics.

  constructor(selectedBatch: Batch) {
    this.batch = selectedBatch;

    // Create the fieldFilters.
    for (const field of selectedBatch.fields) {
      const fieldFilter = new FieldFilter();
      fieldFilter.rangeStart = field.rangeStart;
      fieldFilter.rangeEnd = field.rangeEnd;
      if (!field.isNumber) {
        for (const value of field.uniqueValuesArray) {
          fieldFilter.uniqueValues.add(value);
        }
      }
      this.fieldFilters.push(fieldFilter);
    }

    enableDefaultFilters(this.batch, this.fieldFilters);

    listen(EventType.FILTER_CHANGED, (event) => {
      if (event.detail.batchIndex !== this.batch.index) return;
      this.updateFilteredRows();
      dispatch(
          EventType.FILTERED_DATA_CHANGED,
          {batchIndex: event.detail.batchIndex});
    });
  }

  /** Updates the filteredRowIndices based on the batch and the fieldFilters. */
  updateFilteredRows() {
    this.filteredRowIndices =
        getFilteredRowIndices(this.batch, this.fieldFilters);
  }
}
