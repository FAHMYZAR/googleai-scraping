import * as cheerio from "cheerio";
import { MoodleSessionService } from "./moodleSession";

export class MoodleTasksService {
  private moodle = new MoodleSessionService();

  private clean(text?: string): string {
    if (!text) return "";
    return text.replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private async getCourses() {
    await this.moodle.init();
    const sesskey = await this.moodle.getSesskey();
    const url = `/lib/ajax/service.php?sesskey=${sesskey}&info=core_course_get_enrolled_courses_by_timeline_classification`;
    const payload = [{
      index: 0,
      methodname: "core_course_get_enrolled_courses_by_timeline_classification",
      args: {
        classification: "all",
        limit: 0,
        offset: 0,
        sort: "fullname",
      },
    }];

    const response = await this.moodle.post(url, {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    
    const data = await response.json() as any;
    return data[0]?.data?.courses || [];
  }

  private async getSemesterFourCourses() {
    const courses = await this.getCourses();
    return courses.filter((c: any) => (c.fullname || "").toUpperCase().includes("SEMESTER 4"));
  }

  private async getAssignmentsFromCourse(course: any) {
    const response = await this.moodle.get(`/course/view.php?id=${course.id}`);
    const text = await response.text();
    const $ = cheerio.load(text);

    const assignments: any[] = [];
    const seenIds = new Set<string>();

    // Pattern matching: a href="...mod/assign/view.php?id=XYZ" > span.instancename
    $("a").each((_, el) => {
      const href = $(el).attr("href") || "";
      const match = href.match(/mod\/assign\/view\.php\?id=(\d+)/);
      if (match && match[1]) {
        const assignId = match[1];
        if (seenIds.has(assignId)) return;
        seenIds.add(assignId);

        const instanceName = $(el).find(".instancename").text();
        assignments.push({
          course_id: course.id,
          course_name: course.fullname,
          assign_id: assignId,
          assign_name: this.clean(instanceName).replace("Assignment", "").trim(),
          url: href,
        });
      }
    });

    return assignments;
  }

  private async getAssignmentDetail(assignment: any) {
    const url = assignment.url;
    const response = await this.moodle.get(url);
    const text = await response.text();
    const $ = cheerio.load(text);

    const descHtml = $("#intro").html() || $(".no-overflow").html() || "";
    const description = this.clean(descHtml);

    let opened = "";
    let dueDate = "";
    // find div containing "Opened:" or "Due:"
    $("div").each((_, el) => {
      const html = $(el).html() || "";
      const openedMatch = html.match(/<strong>Opened:<\/strong>\s*(.*?)\s*<\/div>/i);
      if (openedMatch) opened = this.clean(openedMatch[1]);
      const dueMatch = html.match(/<strong>Due:<\/strong>\s*(.*?)\s*<\/div>/i);
      if (dueMatch) dueDate = this.clean(dueMatch[1]);
    });

    let submissionStatus = "";
    let gradingStatus = "";
    let timeRemaining = "";

    $("tr").each((_, el) => {
      const header = this.clean($(el).find("th").text()).toLowerCase();
      const value = this.clean($(el).find("td").text());
      if (header.includes("submission status")) {
        submissionStatus = value;
      } else if (header.includes("grading status")) {
        gradingStatus = value;
      } else if (header.includes("time remaining")) {
        timeRemaining = value;
      }
    });

    return {
      ...assignment,
      description,
      submission_status: submissionStatus,
      grading_status: gradingStatus,
      due_date: dueDate,
      opened,
      time_remaining: timeRemaining,
    };
  }

  async getAllTasks() {
    const results: any[] = [];
    const courses = await this.getSemesterFourCourses();
    for (const course of courses) {
      const assignments = await this.getAssignmentsFromCourse(course);
      for (const assignment of assignments) {
        results.push(await this.getAssignmentDetail(assignment));
      }
    }

    return {
      success: true,
      count: results.length,
      tasks: results,
    };
  }
  
  async validateSession() {
    await this.moodle.init();
    await this.moodle.getSesskey();
  }
}
