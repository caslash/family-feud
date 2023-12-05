//
//  StateLoadQuestions.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/30/23.
//

import Foundation

public class StateLoadQuestions: FFState {
    public static var ACTION_LOADQUESTIONSET: Int = 0x0
    
    private var questions: QuestionSet
    
    internal init(questions: QuestionSet) {
        self.questions = questions
        super.init(type: FFStateType.LOAD_QUESTIONS)
    }
    
    public override func initState(data: Any?) { }
    
    public override func cleanupState() { }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case StateLoadQuestions.ACTION_LOADQUESTIONSET:
            if (data is [String]) {
                self.loadQuestionSet(data: data as! [String])
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
                break
            }
        default:
            return false
        }
        
        return false
    }
    
    private func loadQuestionSet(data: [String]) { self.questions.loadFromJSON(data: data) }
}
