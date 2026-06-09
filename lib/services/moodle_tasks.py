import html
import json
import re
from typing import Any

from lib.services.moodle_session import MoodleSessionService


class MoodleTasksService:
    def __init__(self):
        self.moodle = MoodleSessionService()

    @staticmethod
    def _clean(text: str) -> str:
        if not text:
            return ""
        return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", text)).split())

    def _get_courses(self) -> list[dict[str, Any]]:
        sesskey = self.moodle.get_sesskey()
        url = f"/lib/ajax/service.php?sesskey={sesskey}&info=core_course_get_enrolled_courses_by_timeline_classification"
        payload = [{
            "index": 0,
            "methodname": "core_course_get_enrolled_courses_by_timeline_classification",
            "args": {
                "classification": "all",
                "limit": 0,
                "offset": 0,
                "sort": "fullname",
            },
        }]
        response = self.moodle.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=20)
        data = response.json()
        return data[0].get("data", {}).get("courses", [])

    def _get_semester_four_courses(self) -> list[dict[str, Any]]:
        courses = self._get_courses()
        return [course for course in courses if "SEMESTER 4" in course.get("fullname", "").upper()]

    def _get_assignments_from_course(self, course: dict[str, Any]) -> list[dict[str, Any]]:
        response = self.moodle.get(f"/course/view.php?id={course['id']}", timeout=20)
        matches = re.finditer(
            r'<a[^>]*href="([^"]*mod/assign/view\.php\?id=(\d+))"[^>]*>.*?<span class="instancename">(.*?)</span>',
            response.text,
            re.DOTALL,
        )

        assignments = []
        seen_ids = set()
        for match in matches:
            assign_id = match.group(2)
            if assign_id in seen_ids:
                continue
            seen_ids.add(assign_id)
            assignments.append({
                "course_id": course["id"],
                "course_name": course["fullname"],
                "assign_id": assign_id,
                "assign_name": self._clean(match.group(3)).replace("Assignment", "").strip(),
                "url": match.group(1),
            })
        return assignments

    def _get_assignment_detail(self, assignment: dict[str, Any]) -> dict[str, Any]:
        url = assignment["url"]
        if not url.startswith("http"):
            url = f"{self.moodle.base_url}{url}"

        response = self.moodle.get(url, timeout=20)
        page = response.text

        desc_match = re.search(r'<div[^>]*id="intro"[^>]*>(.*?)</div>', page, re.DOTALL)
        if not desc_match:
            desc_match = re.search(r'<div[^>]*class="[^"]*no-overflow[^"]*"[^>]*>(.*?)</div>', page, re.DOTALL)

        opened_match = re.search(r'<strong>Opened:</strong>\s*(.*?)\s*</div>', page)
        due_match = re.search(r'<strong>Due:</strong>\s*(.*?)\s*</div>', page)

        submission_status = ""
        grading_status = ""
        time_remaining = ""

        rows = re.findall(r'<tr[^>]*>\s*<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>', page, re.DOTALL)
        for header, value in rows:
            label = self._clean(header).lower()
            cleaned_value = self._clean(value)
            if "submission status" in label:
                submission_status = cleaned_value
            elif "grading status" in label:
                grading_status = cleaned_value
            elif "time remaining" in label:
                time_remaining = cleaned_value

        return {
            "course_id": assignment["course_id"],
            "course_name": assignment["course_name"],
            "assign_id": assignment["assign_id"],
            "assign_name": assignment["assign_name"],
            "url": url,
            "description": self._clean(desc_match.group(1)) if desc_match else "",
            "submission_status": submission_status,
            "grading_status": grading_status,
            "due_date": due_match.group(1) if due_match else "",
            "opened": opened_match.group(1) if opened_match else "",
            "time_remaining": time_remaining,
        }

    def get_all_tasks(self) -> dict[str, Any]:
        results = []
        for course in self._get_semester_four_courses():
            assignments = self._get_assignments_from_course(course)
            for assignment in assignments:
                results.append(self._get_assignment_detail(assignment))

        return {
            "success": True,
            "count": len(results),
            "tasks": results,
        }
