import datetime
import requests

SEALIGHTS_LOG_TAG = '[SeaLights]'
DUMMY_TEST_NAME = "SeaLights Dummy"


class SLListener:
    ROBOT_LISTENER_API_VERSION = 3

    test_session_id = ''
    base_url = ''
    token = ''
    bsid = ''
    labid = ''
    stage_name = ''

    def __init__(self, base_url, sltoken, bsid, stagename, labid=""):
        self.base_url = 'https://' + base_url + '/sl-api/v1'
        self.token = sltoken
        self.bsid = bsid
        self.stage_name = stagename
        if labid:
            self.labid = labid
        else:
            self.labid = bsid

    def start_suite(self, suite, result):
        initialize_session_request = {'labId': self.labid, 'testStage': self.stage_name, 'bsid': self.bsid}
        response = requests.post(f'{self.base_url}/test-sessions', json=initialize_session_request, headers=self.get_header())

        if not response.ok:
            print(
                f'>>>> {SEALIGHTS_LOG_TAG} Failed to open Test Session (Error {response.status_code}),'
                f' disabling Sealights Listener')
        else:
            res = response.json()
            self.test_session_id = res["data"]["testSessionId"]
            print(f'>>>> {SEALIGHTS_LOG_TAG} Test session opened, testSessionId: {self.test_session_id}')

        excluded_tests = self.get_excluded_tests()
        print(f'>>>> Excluded tests: {excluded_tests}')

        all_tests = []
        for test in suite.tests:
            all_tests.append(test.name)

        tests_for_execution = list(set(all_tests) - set(excluded_tests))
        print(f'>>>> Tests for execution: {tests_for_execution}')

        if not tests_for_execution:
            tests_for_execution = ["a test name that doesn't show up anywhere"]
        suite.filter(included_tests=tests_for_execution)

        if not suite.has_tests:
            suite.tests.create(DUMMY_TEST_NAME)
            suite.tests[0].keywords.create(name='NoOperation')
        suite.remove_empty_suites()

    def end_test(self, data, result):
        if not self.test_session_id:
            return

        if result.status == 'FAIL':
            test_status = "failed"
        elif result.status == 'SKIP':
            test_status = "skipped"
        else:
            test_status = "passed"

        start_ms = self.get_epoch_timestamp(result.starttime)
        end_ms = self.get_epoch_timestamp(result.endtime)

        results = [{"name": result.name, "status": test_status, "start": start_ms, "end": end_ms}]
        requests.post(f'{self.base_url}/test-sessions/{self.test_session_id}', json=results, headers=self.get_header())

    def end_suite(self, date, result):
        if not self.test_session_id:
            return
        print(f'>>>> {SEALIGHTS_LOG_TAG} Deleting test session {self.test_session_id}')
        requests.delete(f'{self.base_url}/test-sessions/{self.test_session_id}', headers=self.get_header())

    def get_excluded_tests(self):
        recommendations = requests.get(f'{self.base_url}/test-sessions/{self.test_session_id}/exclude-tests', headers=self.get_header())

        print(f'Recommendations: {recommendations.status_code}')
        if recommendations.status_code == 200:
            return recommendations.json()["data"]

        return []

    def get_header(self):
        return {'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'}

    def get_epoch_timestamp(self, value):
        dt_value = datetime.datetime.strptime(value, "%Y%m%d %H:%M:%S.%f")
        return int(dt_value.timestamp() * 1000)
