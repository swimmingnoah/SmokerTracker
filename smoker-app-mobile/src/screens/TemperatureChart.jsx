import { useMemo } from "react";
import { Dimensions, View } from "react-native";
import {
  VictoryArea,
  VictoryAxis,
  VictoryChart,
  VictoryLegend,
  VictoryLine,
} from "victory-native";

const formatTime = (ts) =>
  new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

export default function TemperatureChart({
  data,
  probeColors,
  probeDisplayName,
  hiddenProbes,
  pauses,
}) {
  const width = Dimensions.get("window").width - 32;

  const probes = useMemo(
    () =>
      Object.keys(probeColors).filter(
        (probe) =>
          !hiddenProbes.has(probe) &&
          data.some((d) => d[probe] !== undefined)
      ),
    [probeColors, hiddenProbes, data]
  );

  const lineSeries = useMemo(
    () =>
      probes.map((probe) => ({
        probe,
        color: probeColors[probe],
        name: probeDisplayName(probe),
        points: data
          .filter((d) => d[probe] !== undefined)
          .map((d) => ({ x: d.time, y: d[probe] })),
      })),
    [probes, probeColors, data, probeDisplayName]
  );

  const yMax = useMemo(() => {
    let max = 0;
    for (const d of data) {
      for (const probe of probes) {
        if (d[probe] !== undefined && d[probe] > max) max = d[probe];
      }
    }
    return Math.max(Math.ceil(max * 1.1), 100);
  }, [data, probes]);

  const pauseAreas = useMemo(() => {
    const areas = [];
    for (let i = 0; i < pauses.length; i++) {
      const ev = pauses[i];
      if (ev.type !== "pause") continue;
      const next = pauses[i + 1];
      const x1 = new Date(ev.time).getTime();
      const x2 = next?.type === "resume" ? new Date(next.time).getTime() : Date.now();
      areas.push({ x1, x2 });
    }
    return areas;
  }, [pauses]);

  if (data.length === 0) {
    return null;
  }

  return (
    <View>
      <VictoryChart
        width={width}
        height={320}
        padding={{ top: 20, bottom: 50, left: 50, right: 20 }}
        domainPadding={{ y: 10 }}
      >
        <VictoryAxis
          tickFormat={(t) => formatTime(t)}
          fixLabelOverlap
          style={{
            tickLabels: { fontSize: 10, angle: -35, textAnchor: "end" },
            grid: { stroke: "#e5e7eb", strokeDasharray: "3,3" },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickFormat={(t) => `${t}°`}
          style={{
            tickLabels: { fontSize: 10 },
            grid: { stroke: "#e5e7eb", strokeDasharray: "3,3" },
          }}
        />

        {pauseAreas.map((a, i) => (
          <VictoryArea
            key={`pause-${i}`}
            data={[
              { x: a.x1, y: yMax, y0: 0 },
              { x: a.x2, y: yMax, y0: 0 },
            ]}
            style={{
              data: {
                fill: "#fbbf24",
                fillOpacity: 0.2,
                stroke: "#f59e0b",
                strokeOpacity: 0.4,
              },
            }}
          />
        ))}

        {lineSeries.map((s) => (
          <VictoryLine
            key={s.probe}
            data={s.points}
            style={{ data: { stroke: s.color, strokeWidth: 2 } }}
            interpolation="monotoneX"
          />
        ))}
      </VictoryChart>

      <VictoryLegend
        width={width}
        height={40}
        orientation="horizontal"
        gutter={20}
        style={{ labels: { fontSize: 11 } }}
        data={lineSeries.map((s) => ({
          name: s.name,
          symbol: { fill: s.color },
        }))}
      />
    </View>
  );
}
