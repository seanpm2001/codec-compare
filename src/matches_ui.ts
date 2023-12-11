// Copyright 2023 Google LLC
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

import '@material/mwc-fab';
import '@material/mwc-button';
import '@material/mwc-icon';
import './batch_name_ui';
import './matches_table_ui';

import {css, html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

import {BatchSelection} from './batch_selection';
import {Batch} from './entry';
import {dispatch, EventType, listen} from './events';
import {State} from './state';

/**
 * Component displaying each Match between a given batch and the reference
 * batch.
 */
@customElement('matches-ui')
export class MatchesUi extends LitElement {
  @property({attribute: false}) state!: State;

  private batchSelection: BatchSelection|undefined = undefined;

  override connectedCallback() {
    super.connectedCallback();
    listen(EventType.MATCHES_INFO_REQUEST, (event) => {
      if (event.detail.batchIndex === this.state.referenceBatchSelectionIndex) {
        // There is no meaningful match between a batch and itself.
        // This should not happen. Do nothing.
        return;
      }
      this.batchSelection = this.state.batchSelections[event.detail.batchIndex];
      this.style.display = 'block';
      this.requestUpdate();
    });
    listen(EventType.MATCH_INFO_REQUEST, () => {
      if (this.batchSelection === undefined) return;
      // A row in MatchesTableUi was selected. Close this panel.
      this.batchSelection = undefined;
      this.style.display = 'none';
      this.requestUpdate();
    });
  }

  override render() {
    if (!this.batchSelection) return html``;
    const reference =
        this.state.batchSelections[this.state.referenceBatchSelectionIndex];

    const onClose = () => {
      this.batchSelection = undefined;
      this.style.display = 'none';
      this.requestUpdate();
    };

    const renderBatchHeader = (batch: Batch) => {
      const batchIndex = batch.index;

      const onBatchInfoRequest = () => {
        dispatch(EventType.BATCH_INFO_REQUEST, {batchIndex});
        onClose();
      };
      const onFilteredDataInfoRequest = () => {
        dispatch(EventType.FILTERED_DATA_INFO_REQUEST, {batchIndex});
        onClose();
      };

      return html`
          <div>
            <mwc-button
              raised
              label="Show metadata"
              icon="info"
              @click=${onBatchInfoRequest}>
            </mwc-button>

            <mwc-button
              raised
              label="Filter rows"
              icon="filter_alt"
              @click=${onFilteredDataInfoRequest}>
            </mwc-button>

            <mwc-button
              raised
              label="Show rows"
              icon="clear_all"
              @click=${onFilteredDataInfoRequest}>
            </mwc-button>
          </div>
          `;
    };

    return html`
      <div id="background" @click=${onClose}>
      </div>
      <div id="dialog">
        <div id="batchesHeader">
          <div>
            <div id="matchChip">
              <mwc-icon>join_inner</mwc-icon>
              ${this.batchSelection.matchedDataPoints.rows.length}
            </div>
            <h2>
              matches between
              <batch-name-ui .batch=${reference.batch}></batch-name-ui>
            </h2>
            ${renderBatchHeader(reference.batch)}
          </div>

          <div>
            <h2>
              and
              <batch-name-ui .batch=${this.batchSelection.batch}>
              </batch-name-ui>
            </h2>
            ${renderBatchHeader(this.batchSelection.batch)}
          </div>
        </div>

        <matches-table-ui .state=${this.state}
          .batchSelection=${this.batchSelection}>
        </matches-table-ui>

        <mwc-fab id="closeButton" icon="close" title="Close" @click=${onClose}>
        </mwc-fab>
      </div>
    </div>`;
  }

  static override styles = css`
    :host {
      display: none;
      position: absolute;
      z-index: 5;
      left: 0;
      top: 0;
      bottom: 0;
      right: 0;
    }

    #background {
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
    }

    #dialog {
      background-color: var(--mdc-theme-surface);
      position: absolute;
      left: 40px;
      top: 40px;
      bottom: 40px;
      right: 40px;
      padding: 20px;
      box-shadow: 0 0 8px 0 rgba(0, 0, 0, 0.2);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      /* Rely on margin:auto for distributing the space. */
      justify-content: flex-start;
      gap: 20px;
      overflow: hidden;
    }

    #closeButton {
      position: absolute;
      top: 20px;
      right: 20px;
    }

    #batchesHeader {
      display: flex;
      gap: 20px;
    }
    #batchesHeader > div {
      flex: 1;
      display: flex;
      column-gap: 20px;
      flex-wrap: wrap;
      align-items: center;
    }

    #matchChip {
      padding: 0 15px;
      height: 40px;
      border-radius: 30px;
      background: var(--mdc-theme-primary);
      color: var(--mdc-theme-background);
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 20px;
    }
  `;
}
