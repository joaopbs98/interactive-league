import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const SituationBadge = ({ status }: { status: string }) => {
  const statusStyles = {
    Average: "bg-green-800 text-white",
    "Be Wary of Late Changes": "bg-yellow-500 text-black",
    Warning: "bg-red-800 text-white",
  };

  return (
    <Badge className={statusStyles[status as keyof typeof statusStyles]}>
      {status}
    </Badge>
  );
};

const CompIndexPage = () => {
  return (
    <div className="p-8 flex flex-col gap-8">
      <h2 className="text-lg font-semibold">CompIndex Rankings</h2>

      <div className="flex gap-2">
        <SituationBadge status="Be Wary of Late Changes" />
        <SituationBadge status="Average" />
        <SituationBadge status="Warning" />
      </div>

      <Separator />

      <Card>
        <CardContent className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                <TableHead>Average</TableHead>
                <TableHead>Best 14 Average</TableHead>
                <TableHead>HOF Last 3 Seasons</TableHead>
                <TableHead>HOF Overall</TableHead>
                <TableHead>Situation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["AC Milan", "5.75", "1", "7", "7", "Average"],
                ["AS Roma", "9.25", "2", "12", "12", "Average"],
                ["Atlético Madrid", "3.90", "6", "5", "3", "Average"],
                ["Bayern München", "7.10", "11", "9", "9", "Average"],
                ["Benfica", "11.50", "9", "3", "5", "Average"],
                ["Go Ahead Eagles", "7.40", "8", "11", "10", "Average"],
                [
                  "Inter Miami",
                  "7.60",
                  "13",
                  "6",
                  "1",
                  "Be Wary of Late Changes",
                ],
                [
                  "Liverpool",
                  "7.30",
                  "14",
                  "14",
                  "14",
                  "Be Wary of Late Changes",
                ],
                [
                  "Manchester Utd.",
                  "7.80",
                  "4",
                  "1",
                  "6",
                  "Be Wary of Late Changes",
                ],
                ["PSG", "7.20", "3", "10", "8", "Warning"],
                ["Preußen Münster", "7.50", "10", "4", "4", "Warning"],
                ["Southampton", "7.70", "5", "8", "11", "Warning"],
                ["Stoke City", "7.40", "7", "2", "2", "Warning"],
                ["Willem II", "7.60", "12", "13", "13", "Warning"],
              ].map(([club, avg, best14, hof3, hofOverall, situation]) => (
                <TableRow key={club}>
                  <TableCell>{club}</TableCell>
                  <TableCell>{avg}</TableCell>
                  <TableCell>{best14}</TableCell>
                  <TableCell>{hof3}</TableCell>
                  <TableCell>{hofOverall}</TableCell>
                  <TableCell>
                    <SituationBadge status={situation as string} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          {
            title: "Best 14 Average",
            data: [
              ["AC Milan", "5.75", "Average"],
              ["AS Roma", "9.25", "Be Wary of Late Changes"],
              ["Atlético Madrid", "3.90", "Average"],
              ["Bayern München", "7.10", "Warning"],
            ],
          },
          {
            title: "HOF Last 3 Seasons",
            data: [
              ["AC Milan", "12"],
              ["AS Roma", "24"],
              ["Atlético Madrid", "22"],
              ["Bayern München", "45"],
            ],
          },
          {
            title: "HOF Overall",
            data: [
              ["AC Milan", "12"],
              ["AS Roma", "24"],
              ["Atlético Madrid", "22"],
              ["Bayern München", "45"],
            ],
          },
        ].map((section, idx) => (
          <Card key={idx}>
            <CardContent className="p-4">
              <h4 className="font-semibold mb-4">{section.title}</h4>
              <Table>
                <TableBody>
                  {section.data.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row[0]}</TableCell>
                      <TableCell>{row[1]}</TableCell>
                      {row[2] && (
                        <TableCell>
                          <SituationBadge status={row[2] as string} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CompIndexPage;
