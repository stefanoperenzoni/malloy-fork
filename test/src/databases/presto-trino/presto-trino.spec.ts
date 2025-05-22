/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-disable no-console */

import {RuntimeList} from '../../runtimes';
import {describeIfDatabaseAvailable} from '../../util';
import '../../util/db-jest-matchers';

const [describe, databases] = describeIfDatabaseAvailable(['presto', 'trino']);
const runtimes = new RuntimeList(databases);

describe.each(runtimes.runtimeList)(
  'Presto/Trino dialect functions - %s',

  (databaseName, runtime) => {
    if (runtime === undefined) {
      throw new Error("Couldn't build runtime");
    }
    const presto = databaseName === 'presto';
    it(`runs an sql query - ${databaseName}`, async () => {
      await expect(
        `run: ${databaseName}.sql("SELECT 1 as n") -> { select: n }`
      ).malloyResultMatches(runtime, {n: 1});
    });
    test.when(databaseName === 'presto')(
      'schema parser does not throw on compound types',
      async () => {
        const abrec = 'CAST(ROW(0,1) AS ROW(a DOUBLE,b DOUBLE))';
        await expect(`
          run: ${databaseName}.sql("""
            SELECT
              ${abrec} as "abrec",
              ARRAY['c', 'd'] as str_array,
              array[1,2,3] as int_array,
              ARRAY[${abrec}] as array_of_abrec
          """)
      `).malloyResultMatches(runtime, {});
      }
    );

    it(`runs the max_by function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 1 as y, 55 as x
      UNION ALL SELECT 50 as y, 22 as x
      UNION ALL SELECT 100 as y, 1 as x
      """) -> {
      aggregate:
        m1 is max_by(x, y)
        m2 is max_by(y, x)
      }`).malloyResultMatches(runtime, {m1: 1, m2: 1});
    });

    it(`runs the max_by function groups - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 1 as y, 55 as x, z as a
      UNION ALL SELECT 50 as y, 22 as x, z as a
      UNION ALL SELECT 100 as y, 1 as x, z as b
      """) -> {
      group_by:
        z
      aggregate:
        m1 is max_by(x, y)
        m2 is max_by(y, x)
      }`).malloyResultMatches(runtime, {m1: 1, m2: 1});
    });

    it(`runs the min_by function - ${databaseName}`, async () => {
      await expect(`run: ${databaseName}.sql("""
                SELECT 1 as y, 55 as x
      UNION ALL SELECT 50 as y, 22 as x
      UNION ALL SELECT 100 as y, 1 as x
      """) -> {
      aggregate:
        m1 is min_by(x, y)
        m2 is min_by(y, x)
      }`).malloyResultMatches(runtime, {m1: 55, m2: 100});
    });

  }
);

afterAll(async () => {
  await runtimes.closeAll();
});
