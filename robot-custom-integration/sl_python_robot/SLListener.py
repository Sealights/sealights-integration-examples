import datetime
import requests

SEALIGHTS_LOG_TAG = '[SeaLights]'
DUMMY_TEST_NAME = "SeaLights Dummy"
TEST_STATUS_MAP = {"FAIL": "failed", "SKIP": "skipped"}


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
        self.excluded_tests = []
        if labid:
            self.labid = labid
        else:
            self.labid = bsid

    def start_suite(self, suite, result):
        self.create_test_session()
        self.excluded_tests = set(self.get_excluded_tests())
        print(f'>>>> Skipped tests: {list(self.excluded_tests)}')

        all_tests = set()
        for test in suite.tests:
            all_tests.add(test.name)
            if test.name in self.excluded_tests:
                test.body.create_keyword(name="SKIP")

        tests_for_execution = list(all_tests - self.excluded_tests)
        print(f'>>>> Tests for execution: {tests_for_execution}')

    def end_suite(self, date, result):
        if not self.test_session_id:
            return
        test_results = self.build_test_results(result)
        if test_results:
            requests.post(self.get_session_url(), json=test_results, headers=self.get_header())
            print(f'>>>> {SEALIGHTS_LOG_TAG} Results: {test_results}')
        print(f'>>>> {SEALIGHTS_LOG_TAG} Deleting test session {self.test_session_id}')
        requests.delete(self.get_session_url(), headers=self.get_header())

    def create_test_session(self):
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

    def get_excluded_tests(self):
        recommendations = requests.get(f'{self.get_session_url()}/exclude-tests', headers=self.get_header())
        print(f'Recommendations: {recommendations.status_code}')
        if recommendations.status_code == 200:
            return recommendations.json()["data"]
        return []

    def get_header(self):
        return {'Authorization': 'Bearer ' + self.token, 'Content-Type': 'application/json'}

    def get_session_url(self):
        return f'{self.base_url}/test-sessions/{self.test_session_id}'

    def build_test_results(self, result):
        tests = []
        for test in result.tests:
            test_status = TEST_STATUS_MAP.get(test.status, "passed")
            start_ms = self.get_epoch_timestamp(result.starttime)
            end_ms = self.get_epoch_timestamp(result.endtime)
            tests.append({"name": test.name, "status": test_status, "start": start_ms, "end": end_ms})
        return tests

    def get_epoch_timestamp(self, value):
        dt_value = datetime.datetime.strptime(value, "%Y%m%d %H:%M:%S.%f")
        return int(dt_value.timestamp() * 1000)
