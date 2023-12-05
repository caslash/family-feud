//
//  StateFaceOff.swift
//  FeudKit
//
//  Created by Cameron Slash on 11/26/23.
//

import Foundation

public class StateFaceOff: FFPlayState, StrikeInterface {
    public static var ACTION_CHOOSEFAMILY: Int = 0x1
    
    public static var ACTION_OPENANSWER: Int = 0x2
    
    public static var ACTION_STRIKE: Int = 0x3
    
    private var questions: QuestionSet
    
    private var selectedIndex: Int?
    
    private var selectedFamilyIndex: Int?
    
    private var strikes: Int?
    
    internal init(questions: QuestionSet) {
        self.questions = questions
        super.init(type: FFPlayStateType.FACE_OFF)
    }
    
    public override func initState(data: Any?) {
        self.selectedFamilyIndex = -1
        
        if (data is Int) {
            self.selectedIndex = data as? Int
        } else {
            //TODO: InvalidDataException
            fatalError("InvalidDataException not implemented")
        }
    }
    
    public override func cleanupState() {
        self.data = [self.questions.getQuestion(index: self.selectedIndex ?? 0) as Any, self.selectedFamilyIndex as Any]
        self.strikes = 0
    }
    
    public override func executeAction(action: Int, data: [Any]) -> Bool {
        switch action {
        case StateFaceOff.ACTION_OPENANSWER:
            if (data[1] is Int) {
                self.openAnswer(index: data[1] as! Int)
                return true
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
            }
        case StateFaceOff.ACTION_CHOOSEFAMILY:
            if (data[1] is Int) {
                self.selectFamily(index: data[1] as! Int)
                return true
            } else {
                //TODO: InvalidDataException
                fatalError("InvalidDataException not implemented")
            }
        case StateFaceOff.ACTION_STRIKE:
            self.strike()
            return true
        default:
            //TODO: RuntimeException
            fatalError("RuntimeException not implemented")
        }
    }
    
    public override func canAdvance(nextState: String) -> Bool { return self.selectedFamilyIndex ?? 0 >= 0 }
    
    private func strike() {
        //TODO: Logger
        print("Strike!")
        self.strikes = (self.strikes ?? 0) + 1
    }
    
    public func getStrikes() -> Int? { return self.strikes }
    
    private func openAnswer(index: Int) {
        if (!(self.questions.getQuestion(index: self.selectedIndex ?? 0).getAnswers())[index].isRevealed()) {
            (self.questions.getQuestion(index: self.selectedIndex ?? 0).getAnswers())[index].setRevealed(revealed: true)
            //TODO: Logger
            print("Revealed answer: \(self.questions.getQuestion(index: self.selectedIndex ?? 0).getAnswers()[index])")
        } else {
            //TODO: Logger
            print("Answer already revealed!")
        }
    }
    
    private func selectFamily(index: Int) {
        self.selectedFamilyIndex = index
        //TODO: Logger
        print("Family [\(self.selectedFamilyIndex!)] selected.")
    }
}
